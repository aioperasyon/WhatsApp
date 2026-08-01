import type {
  WASocket,
} from '@whiskeysockets/baileys';

interface MessageUpdateLike {
  key?: {
    id?: string | null;
  } | null;
  update?: {
    status?: number | null;
    messageStubParameters?: string[] | null;
  } | null;
}

interface RejectionWaiter {
  resolve(): void;
  reject(reason: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface WhatsAppSendRequest {
  recipient: string;
  text: string;
  operationLabel: string;
  chatId?: string;
  verifyNewRecipient?: boolean;
}

export interface WhatsAppSendResult {
  remoteJid: string;
  whatsappMessageId: string;
  sentAt: string;
}

function normalizeInputToJid(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Mesaj alıcısı bulunamadı.');
  }

  if (
    trimmed.endsWith('@s.whatsapp.net') ||
    trimmed.endsWith('@lid') ||
    trimmed.endsWith('@g.us')
  ) {
    return trimmed;
  }

  const phoneNumber = trimmed.replace(/\D/g, '');

  if (!phoneNumber) {
    throw new Error('Geçerli bir WhatsApp numarası bulunamadı.');
  }

  return `${phoneNumber}@s.whatsapp.net`;
}

function getPhoneNumber(value: string): string {
  return value.split('@')[0]?.replace(/\D/g, '') ?? '';
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRestrictionDate(value: unknown): string {
  if (value == null) {
    return 'WhatsApp sunucusunun belirlediği süre dolana kadar';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function getRestrictionError(
  parameters: string[] | null | undefined,
): Error | null {
  if (!parameters?.length) {
    return null;
  }

  const combined = parameters.join(' ').toLowerCase();

  if (
    combined.includes('your account has been restricted') ||
    combined.includes('account has been restricted') ||
    parameters.includes('463')
  ) {
    return new Error(
      'WhatsApp mobil uygulaması çalışıyor; ancak bağlı cihaz mesajı WhatsApp sunucusu tarafından 463 koduyla reddedildi.',
    );
  }

  return null;
}

export class WhatsAppSendService {
  private readonly rejectionWaiters =
    new Map<string, RejectionWaiter>();

  constructor(
    private readonly accountId: string,
    private readonly socket: WASocket,
  ) {}

  handleMessagesUpdate(updates: MessageUpdateLike[]): void {
    for (const item of updates) {
      const messageId = item.key?.id ?? null;
      const status = item.update?.status;
      const parameters =
        item.update?.messageStubParameters ?? null;

      if (!messageId) {
        continue;
      }

      console.log(
        `[WhatsApp ACK] ${this.accountId} ` +
          `messageId=${messageId} ` +
          `status=${status == null ? '-' : Number(status)} ` +
          `update=${safeJson(item.update)}`,
      );

      const rejectionError =
        getRestrictionError(parameters);

      if (rejectionError) {
        const waiter =
          this.rejectionWaiters.get(messageId);

        if (waiter) {
          clearTimeout(waiter.timeout);
          this.rejectionWaiters.delete(messageId);
          waiter.reject(rejectionError);
        }
      }
    }
  }

  rejectPending(message: string): void {
    for (const waiter of this.rejectionWaiters.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(message));
    }

    this.rejectionWaiters.clear();
  }

  async send(
    request: WhatsAppSendRequest,
  ): Promise<WhatsAppSendResult> {
    const text = request.text.trim();

    if (!text) {
      throw new Error('Boş mesaj gönderilemez.');
    }

    let remoteJid = normalizeInputToJid(request.recipient);

    try {
      remoteJid = await this.resolveRecipient(request.recipient);

      if (request.verifyNewRecipient === true) {
        await this.assertNewConversationAllowed();
      }

      const result = await this.socket.sendMessage(
        remoteJid,
        {
          text,
        },
      );

      if (!result?.key?.id) {
        throw new Error(
          'WhatsApp geçerli bir mesaj kimliği döndürmedi.',
        );
      }

      const whatsappMessageId = result.key.id;
      const resolvedRemoteJid =
        result.key.remoteJid ?? remoteJid;

      await this.waitForImmediateRejection(
        whatsappMessageId,
        2500,
      );

      const sentAt = new Date().toISOString();

      console.log(
        `[Inbox] ${this.accountId} ${request.operationLabel} ` +
          `gönderim kabul edildi | ` +
          `${request.chatId ? `chatId=${request.chatId} ` : ''}` +
          `jid=${resolvedRemoteJid} ` +
          `messageId=${whatsappMessageId}`,
      );

      return {
        remoteJid: resolvedRemoteJid,
        whatsappMessageId,
        sentAt,
      };
    } catch (reason: unknown) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Bilinmeyen WhatsApp gönderim hatası.';

      console.error(
        `[Inbox] ${this.accountId} ${request.operationLabel} başarısız | ` +
          `${request.chatId ? `chatId=${request.chatId} ` : ''}` +
          `jid=${remoteJid} ` +
          `hata=${message}`,
      );

      throw new Error(message);
    }
  }

  private async assertNewConversationAllowed(): Promise<void> {
    try {
      const timelock =
        await this.socket.fetchAccountReachoutTimelock();

      console.log(
        `[WhatsApp Reachout] ${this.accountId} ` +
          `timelock=${safeJson(timelock)}`,
      );

      if (timelock?.isActive === true) {
        const endsAt = formatRestrictionDate(
          timelock.timeEnforcementEnds,
        );

        throw new Error(
          `WhatsApp mobil uygulaması çalışıyor; ancak bu bağlı cihazın yeni numaralara sohbet başlatması WhatsApp sunucusu tarafından geçici olarak engellenmiş. ` +
            `Bağlı cihaz kısıtının bitiş zamanı: ${endsAt}.`,
        );
      }
    } catch (reason: unknown) {
      if (
        reason instanceof Error &&
        reason.message.includes(
          'WhatsApp mobil uygulaması çalışıyor; ancak bu bağlı cihazın yeni numaralara sohbet başlatması',
        )
      ) {
        throw reason;
      }

      console.warn(
        `[WhatsApp Reachout] ${this.accountId} ` +
          `timelock okunamadı | hata=${
            reason instanceof Error
              ? reason.message
              : safeJson(reason)
          }`,
      );
    }
  }

  private waitForImmediateRejection(
    messageId: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.rejectionWaiters.delete(messageId);
        resolve();
      }, timeoutMs);

      this.rejectionWaiters.set(messageId, {
        resolve,
        reject,
        timeout,
      });
    });
  }

  private async resolveRecipient(value: string): Promise<string> {
    const normalizedJid = normalizeInputToJid(value);

    if (
      normalizedJid.endsWith('@g.us') ||
      normalizedJid.endsWith('@lid')
    ) {
      return normalizedJid;
    }

    const phoneNumber = getPhoneNumber(normalizedJid);

    if (!phoneNumber) {
      throw new Error(
        'Geçerli bir WhatsApp telefon numarası bulunamadı.',
      );
    }

    const matches = await this.socket.onWhatsApp(phoneNumber);
    const match = matches?.find((item) => item.exists);

    console.log(
      `[WhatsApp Recipient] ${this.accountId} ` +
        `phone=${phoneNumber} matches=${safeJson(matches)}`,
    );

    if (!match?.jid) {
      throw new Error(
        'Bu telefon numarası WhatsApp üzerinde bulunamadı.',
      );
    }

    return match.jid;
  }
}
