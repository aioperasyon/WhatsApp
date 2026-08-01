import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import fs from 'node:fs';
import QRCode from 'qrcode';
import pino from 'pino';
import type {
  WhatsAppConnectionState,
} from '../../../shared/interfaces/desktop-api.js';
import type {
  InboxSendMessageRequest,
  InboxSendMessageResult,
  InboxStartConversationRequest,
  InboxStartConversationResult,
} from '../../../shared/interfaces/inbox.js';
import {
  getWhatsAppAccount,
  updateWhatsAppAccountConnection,
} from '../repositories/whatsapp-account.repository.js';
import { getInboxRuntimeService } from './inbox-container.service.js';

interface MessageAckWaiter {
  resolve(status: number): void;
  reject(reason: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

interface RuntimeConnection {
  socket: WASocket;
  qrDataUrl: string | null;
  message: string | null;
  manuallyClosed: boolean;
  recentMessageStatuses: Map<string, number>;
  ackWaiters: Map<string, MessageAckWaiter>;
}

const connections = new Map<string, RuntimeConnection>();
const logger = pino({ level: 'silent' });

function requireAccount(accountId: string) {
  const account = getWhatsAppAccount(accountId);

  if (!account) {
    throw new Error('WhatsApp hesabı bulunamadı.');
  }

  return account;
}

function buildState(accountId: string): WhatsAppConnectionState {
  const account = requireAccount(accountId);
  const runtime = connections.get(accountId);

  return {
    account,
    qrDataUrl: runtime?.qrDataUrl ?? null,
    message: runtime?.message ?? null,
  };
}

function normalizeSendJid(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Mesaj alıcısı bulunamadı.');
  }

  if (trimmed.endsWith('@s.whatsapp.net') || trimmed.endsWith('@g.us')) {
    return trimmed;
  }

  const phoneNumber = trimmed.replace(/\D/g, '');

  if (!phoneNumber) {
    throw new Error('Geçerli bir WhatsApp numarası bulunamadı.');
  }

  return `${phoneNumber}@s.whatsapp.net`;
}

async function resolveWhatsAppRecipient(
  socket: WASocket,
  value: string,
): Promise<string> {
  const normalizedJid = normalizeSendJid(value);

  if (normalizedJid.endsWith('@g.us')) {
    return normalizedJid;
  }

  const phoneNumber =
    normalizedJid.split('@')[0]?.replace(/\D/g, '') ?? '';

  const matches = await socket.onWhatsApp(phoneNumber);
  const match = matches?.find((item) => item.exists);

  if (!match?.jid) {
    throw new Error(
      'Bu telefon numarası WhatsApp üzerinde bulunamadı.',
    );
  }

  return normalizeSendJid(match.jid);
}

function rememberMessageStatus(
  runtime: RuntimeConnection,
  messageId: string,
  status: number,
): void {
  runtime.recentMessageStatuses.set(messageId, status);

  if (runtime.recentMessageStatuses.size > 500) {
    const oldestKey = runtime.recentMessageStatuses.keys().next().value;

    if (oldestKey) {
      runtime.recentMessageStatuses.delete(oldestKey);
    }
  }

  const waiter = runtime.ackWaiters.get(messageId);

  if (waiter && status >= 2) {
    clearTimeout(waiter.timeout);
    runtime.ackWaiters.delete(messageId);
    waiter.resolve(status);
  }
}

function waitForServerAck(
  runtime: RuntimeConnection,
  messageId: string,
  timeoutMs = 15000,
): Promise<number> {
  const knownStatus = runtime.recentMessageStatuses.get(messageId);

  if (knownStatus != null && knownStatus >= 2) {
    return Promise.resolve(knownStatus);
  }

  return new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      runtime.ackWaiters.delete(messageId);
      reject(
        new Error(
          'WhatsApp sunucu onayı alınamadı. Mesaj gönderilmiş kabul edilmedi.',
        ),
      );
    }, timeoutMs);

    runtime.ackWaiters.set(messageId, {
      resolve,
      reject,
      timeout,
    });
  });
}

function rejectPendingAcks(
  runtime: RuntimeConnection,
  message: string,
): void {
  for (const waiter of runtime.ackWaiters.values()) {
    clearTimeout(waiter.timeout);
    waiter.reject(new Error(message));
  }

  runtime.ackWaiters.clear();
}

function getDisconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    output?: {
      statusCode?: number;
    };
    statusCode?: number;
  };

  return candidate.output?.statusCode ?? candidate.statusCode;
}

interface SendTextMessageInput {
  accountId: string;
  recipient: string;
  text: string;
  operationLabel: string;
  chatId?: string;
  refreshRecipientDevices?: boolean;
}

interface SendTextMessageOutput {
  remoteJid: string;
  whatsappMessageId: string;
  sentAt: string;
  ackStatus: number;
}

function requireConnectedRuntime(
  accountId: string,
): RuntimeConnection {
  const runtime = connections.get(accountId);

  if (!runtime) {
    throw new Error(
      'WhatsApp hesabı bağlı değil. Önce hesabı bağlayın.',
    );
  }

  const account = requireAccount(accountId);

  if (account.status !== 'connected') {
    throw new Error(
      'WhatsApp bağlantısı henüz mesaj göndermeye hazır değil.',
    );
  }

  return runtime;
}

async function sendTextMessage(
  input: SendTextMessageInput,
): Promise<SendTextMessageOutput> {
  const runtime = requireConnectedRuntime(input.accountId);
  const text = input.text.trim();

  if (!text) {
    throw new Error('Boş mesaj gönderilemez.');
  }

  let remoteJid = normalizeSendJid(input.recipient);

  try {
    remoteJid = await resolveWhatsAppRecipient(
      runtime.socket,
      input.recipient,
    );

    if (
      input.refreshRecipientDevices === true &&
      remoteJid.endsWith('@s.whatsapp.net')
    ) {
      const devices =
        (await runtime.socket.getUSyncDevices(
          [remoteJid],
          false,
          false,
        )) ?? [];

      console.log(
        `[Inbox] ${input.accountId} alıcı cihaz çözümleme | ` +
          `jid=${remoteJid} cihaz=${devices.length}`,
      );

      if (devices.length === 0) {
        throw new Error(
          'Alıcının WhatsApp cihaz bilgileri alınamadı. ' +
            'Yeni sohbet başlatılamadı.',
        );
      }
    }

    const result = await runtime.socket.sendMessage(
      remoteJid,
      {
        text,
      },
    );

    const whatsappMessageId = result?.key?.id ?? null;

    if (!whatsappMessageId) {
      throw new Error(
        'WhatsApp geçerli bir mesaj kimliği döndürmedi.',
      );
    }

    const ackStatus = await waitForServerAck(
      runtime,
      whatsappMessageId,
      20000,
    );
    const sentAt = new Date().toISOString();

    console.log(
      `[Inbox] ${input.accountId} ${input.operationLabel} ` +
        `sunucu tarafından onaylandı | ` +
        `ack=${ackStatus} ` +
        `${input.chatId ? `chatId=${input.chatId} ` : ''}` +
        `jid=${remoteJid} ` +
        `messageId=${whatsappMessageId}`,
    );

    return {
      remoteJid,
      whatsappMessageId,
      sentAt,
      ackStatus,
    };
  } catch (reason: unknown) {
    const message =
      reason instanceof Error
        ? reason.message
        : 'Bilinmeyen WhatsApp gönderim hatası.';

    console.error(
      `[Inbox] ${input.accountId} ${input.operationLabel} başarısız | ` +
        `${input.chatId ? `chatId=${input.chatId} ` : ''}` +
        `jid=${remoteJid} ` +
        `hata=${message}`,
    );

    throw new Error(message);
  }
}

export async function startInboxConversation(
  request: InboxStartConversationRequest,
): Promise<InboxStartConversationResult> {
  const accountId = request.accountId?.trim();
  const text = request.text?.trim();
  const phoneNumber =
    request.phoneNumber?.replace(/\D/g, '') ?? '';

  if (!accountId) {
    throw new Error('WhatsApp hesap kimliği zorunludur.');
  }

  if (!phoneNumber) {
    throw new Error('Geçerli bir WhatsApp numarası girin.');
  }

  if (phoneNumber.length < 10 || phoneNumber.length > 15) {
    throw new Error(
      'Telefon numarasını ülke koduyla birlikte girin.',
    );
  }

  if (!text) {
    throw new Error('Boş mesaj gönderilemez.');
  }

  try {
    const result = await sendTextMessage({
      accountId,
      recipient: phoneNumber,
      text,
      operationLabel: 'yeni sohbet mesajı',
      refreshRecipientDevices: true,
    });

    return {
      remoteJid: result.remoteJid,
      whatsappMessageId: result.whatsappMessageId,
      sentAt: result.sentAt,
    };
  } catch (reason: unknown) {
    const message =
      reason instanceof Error
        ? reason.message
        : 'Bilinmeyen WhatsApp gönderim hatası.';

    throw new Error(
      `Yeni sohbet başlatılamadı: ${message}`,
    );
  }
}

export async function sendInboxMessage(
  request: InboxSendMessageRequest,
): Promise<InboxSendMessageResult> {
  const accountId = request.accountId?.trim();
  const text = request.text?.trim();

  if (!accountId) {
    throw new Error('WhatsApp hesap kimliği zorunludur.');
  }

  if (!request.chatId?.trim()) {
    throw new Error('Sohbet kimliği zorunludur.');
  }

  if (!request.remoteJid?.trim()) {
    throw new Error('Mesaj alıcısı bulunamadı.');
  }

  if (!text) {
    throw new Error('Boş mesaj gönderilemez.');
  }

  try {
    const result = await sendTextMessage({
      accountId,
      recipient: request.remoteJid,
      text,
      operationLabel: 'sohbet mesajı',
      chatId: request.chatId,
      refreshRecipientDevices: false,
    });

    return {
      whatsappMessageId: result.whatsappMessageId,
      sentAt: result.sentAt,
    };
  } catch (reason: unknown) {
    const message =
      reason instanceof Error
        ? reason.message
        : 'Bilinmeyen WhatsApp gönderim hatası.';

    throw new Error(
      `WhatsApp mesajı gönderilemedi: ${message}`,
    );
  }
}

export async function connectWhatsAppAccount(
  accountId: string,
): Promise<WhatsAppConnectionState> {
  const account = requireAccount(accountId);
  const existing = connections.get(accountId);

  if (existing) {
    return buildState(accountId);
  }

  updateWhatsAppAccountConnection(accountId, {
    status: 'connecting',
  });

  const { state, saveCreds } = await useMultiFileAuthState(
    account.sessionPath,
  );
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    auth: state,
    version,
    browser: Browsers.windows('AI Operasyon CRM'),
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
  });

  const runtime: RuntimeConnection = {
    socket,
    qrDataUrl: null,
    message: 'WhatsApp bağlantısı başlatılıyor.',
    manuallyClosed: false,
    recentMessageStatuses: new Map<string, number>(),
    ackWaiters: new Map<string, MessageAckWaiter>(),
  };

  connections.set(accountId, runtime);
  getInboxRuntimeService().attachAccount(accountId, socket);

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('messages.update', (updates) => {
    for (const item of updates) {
      const messageId = item.key?.id;
      const status = item.update?.status;

      if (!messageId || status == null) {
        continue;
      }

      rememberMessageStatus(runtime, messageId, Number(status));

      console.log(
        `[WhatsApp ACK] ${accountId} ` +
          `messageId=${messageId} status=${Number(status)}`,
      );
    }
  });

  socket.ev.on('connection.update', async (update) => {
    const current = connections.get(accountId);

    if (!current) {
      return;
    }

    if (update.qr) {
      current.qrDataUrl = await QRCode.toDataURL(update.qr, {
        margin: 1,
        width: 320,
      });
      current.message = 'QR kodunu WhatsApp ile okutun.';

      updateWhatsAppAccountConnection(accountId, {
        status: 'qr_required',
      });
    }

    if (update.connection === 'open') {
      const userId = socket.user?.id ?? null;
      const phoneNumber = userId
        ? userId.split(':')[0]?.split('@')[0] ?? null
        : null;

      current.qrDataUrl = null;
      current.message =
        'WhatsApp hesabı bağlandı. Sohbet geçmişi senkronize ediliyor.';

      updateWhatsAppAccountConnection(accountId, {
        status: 'connected',
        phoneNumber,
        lastConnectedAt: new Date().toISOString(),
      });
    }

    if (update.connection === 'close') {
      const statusCode = getDisconnectStatusCode(
        update.lastDisconnect?.error,
      );
      const loggedOut =
        statusCode === DisconnectReason.loggedOut;

      rejectPendingAcks(
        current,
        'WhatsApp bağlantısı mesaj onayı alınmadan kapandı.',
      );
      getInboxRuntimeService().detachAccount(accountId);
      connections.delete(accountId);

      updateWhatsAppAccountConnection(accountId, {
        status: loggedOut ? 'disconnected' : 'error',
        phoneNumber: loggedOut ? null : undefined,
        lastConnectedAt: loggedOut ? null : undefined,
      });

      if (!current.manuallyClosed && !loggedOut) {
        setTimeout(() => {
          void connectWhatsAppAccount(accountId).catch(() => {
            updateWhatsAppAccountConnection(accountId, {
              status: 'error',
            });
          });
        }, 3000);
      }
    }
  });

  return buildState(accountId);
}

export function getWhatsAppConnectionState(
  accountId: string,
): WhatsAppConnectionState {
  return buildState(accountId);
}

export async function disconnectWhatsAppAccount(
  accountId: string,
): Promise<WhatsAppConnectionState> {
  const account = requireAccount(accountId);
  const runtime = connections.get(accountId);

  getInboxRuntimeService().detachAccount(accountId);

  if (runtime) {
    runtime.manuallyClosed = true;
    rejectPendingAcks(
      runtime,
      'WhatsApp bağlantısı kullanıcı tarafından kapatıldı.',
    );

    try {
      await Promise.race([
        runtime.socket.logout(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(
            () => reject(new Error('WhatsApp çıkış işlemi zaman aşımına uğradı.')),
            8000,
          );
        }),
      ]);
    } catch (reason: unknown) {
      console.warn(
        `[WhatsApp] ${accountId} uzak oturum kapatma uyarısı:`,
        reason instanceof Error ? reason.message : reason,
      );

      runtime.socket.end(
        new Error('Kullanıcı WhatsApp bağlantısını kapattı.'),
      );
    } finally {
      connections.delete(accountId);
    }
  }

  try {
    fs.rmSync(account.sessionPath, {
      recursive: true,
      force: true,
    });
    fs.mkdirSync(account.sessionPath, {
      recursive: true,
    });
  } catch (reason: unknown) {
    console.warn(
      `[WhatsApp] ${accountId} yerel oturum temizleme uyarısı:`,
      reason instanceof Error ? reason.message : reason,
    );
  }

  updateWhatsAppAccountConnection(accountId, {
    status: 'disconnected',
    phoneNumber: null,
    lastConnectedAt: null,
  });

  return buildState(accountId);
}

export async function closeAllWhatsAppConnections(): Promise<void> {
  const inboxRuntime = getInboxRuntimeService();

  for (const [accountId, runtime] of connections) {
    inboxRuntime.detachAccount(accountId);
    runtime.manuallyClosed = true;
    rejectPendingAcks(
      runtime,
      'Uygulama mesaj onayı alınmadan kapatıldı.',
    );
    runtime.socket.end(new Error('Uygulama kapatılıyor.'));
    connections.delete(accountId);
  }
}
