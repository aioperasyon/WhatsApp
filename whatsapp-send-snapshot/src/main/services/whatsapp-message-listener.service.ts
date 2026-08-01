import type { proto } from '@whiskeysockets/baileys';
import type { InboxMessageStatus } from '../../../shared/interfaces/inbox.js';
import type { InboxEventBusService } from './inbox-event-bus.service.js';
import type { InboxService } from './inbox.service.js';
import type { WhatsAppMessageNormalizerService } from './whatsapp-message-normalizer.service.js';

interface MessagesUpsertPayload {
  messages: proto.IWebMessageInfo[];
  type?: string;
}

interface MessageUpdateItem {
  key?: proto.IMessageKey | null;
  update?: {
    status?: number | null;
  } | null;
}

interface HistoryContact {
  id?: string | null;
  name?: string | null;
  notify?: string | null;
  verifiedName?: string | null;
}

interface HistoryChat {
  id?: string | null;
  name?: string | null;
}

interface MessagingHistoryPayload {
  chats?: HistoryChat[];
  contacts?: HistoryContact[];
  messages?: proto.IWebMessageInfo[];
  progress?: number | null;
  isLatest?: boolean | null;
  syncType?: unknown;
}

interface LidMappingLike {
  getPNForLID(lid: string): Promise<string | null | undefined>;
}

interface WhatsAppEventEmitterLike {
  on(
    event: 'messages.upsert',
    listener: (payload: MessagesUpsertPayload) => void,
  ): void;
  on(
    event: 'messages.update',
    listener: (updates: MessageUpdateItem[]) => void,
  ): void;
  on(
    event: 'messaging-history.set',
    listener: (payload: MessagingHistoryPayload) => void,
  ): void;
  off(
    event: 'messages.upsert',
    listener: (payload: MessagesUpsertPayload) => void,
  ): void;
  off(
    event: 'messages.update',
    listener: (updates: MessageUpdateItem[]) => void,
  ): void;
  off(
    event: 'messaging-history.set',
    listener: (payload: MessagingHistoryPayload) => void,
  ): void;
}

export interface WhatsAppSocketLike {
  ev: WhatsAppEventEmitterLike;
  signalRepository?: {
    lidMapping?: LidMappingLike;
  };
}

function mapBaileysStatus(
  status: number | null | undefined,
): InboxMessageStatus | null {
  if (status == null) return null;

  if (status >= 4) return 'read';
  if (status === 3) return 'delivered';
  if (status === 2) return 'sent';

  /*
   * Baileys 0 ve 1 durumlarını gönderim sırasında geçici olarak
   * yayınlayabilir. Mesaj sendMessage() tarafından kabul edildikten
   * ve messages.upsert ile "sent" kaydedildikten sonra bu geçici
   * durumların kaydı tekrar "pending" seviyesine düşürmesine izin
   * vermiyoruz.
   */
  return null;
}

function normalizePhoneJid(jid: string): string {
  const user = jid.split('@')[0]?.split(':')[0] ?? jid;
  return `${user}@s.whatsapp.net`;
}

function phoneNumberFromJid(jid: string): string | null {
  if (!jid.endsWith('@s.whatsapp.net')) return null;
  const number = jid.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') ?? '';
  return number || null;
}

export class WhatsAppMessageListenerService {
  constructor(
    private readonly inboxService: InboxService,
    private readonly normalizer: WhatsAppMessageNormalizerService,
    private readonly eventBus: InboxEventBusService,
  ) {}

  attach(accountId: string, socket: WhatsAppSocketLike): () => void {
    const contactNames = new Map<string, string>();

    const resolveRemoteJid = async (
      rawMessage: proto.IWebMessageInfo,
    ): Promise<{ originalJid: string; resolvedJid: string }> => {
      const key = rawMessage.key;
      const keyWithAlternative = key as proto.IMessageKey & {
        remoteJidAlt?: string | null;
      };

      const originalJid = key?.remoteJid ?? '';
      const alternativeJid = keyWithAlternative.remoteJidAlt;

      if (alternativeJid?.endsWith('@s.whatsapp.net')) {
        return {
          originalJid,
          resolvedJid: normalizePhoneJid(alternativeJid),
        };
      }

      if (originalJid.endsWith('@s.whatsapp.net')) {
        return {
          originalJid,
          resolvedJid: normalizePhoneJid(originalJid),
        };
      }

      if (originalJid.endsWith('@lid')) {
        try {
          const phoneJid =
            await socket.signalRepository?.lidMapping?.getPNForLID(
              originalJid,
            );

          if (phoneJid) {
            return {
              originalJid,
              resolvedJid: normalizePhoneJid(phoneJid),
            };
          }
        } catch (reason: unknown) {
          const message =
            reason instanceof Error ? reason.message : String(reason);
          console.warn(
            `[Inbox] ${accountId} LID eşleştirmesi yapılamadı: ${message}`,
          );
        }
      }

      return {
        originalJid,
        resolvedJid: originalJid,
      };
    };

    const processMessage = async (
      rawMessage: proto.IWebMessageInfo,
      incrementUnread: boolean,
    ): Promise<void> => {
      try {
        const { originalJid, resolvedJid } =
          await resolveRemoteJid(rawMessage);

        if (
          originalJid &&
          resolvedJid &&
          originalJid !== resolvedJid
        ) {
          this.inboxService.mergeChatIdentity(
            accountId,
            originalJid,
            resolvedJid,
            phoneNumberFromJid(resolvedJid),
          );
        }

        const displayName =
          contactNames.get(resolvedJid) ??
          contactNames.get(originalJid) ??
          rawMessage.pushName ??
          null;

        const normalized = this.normalizer.normalize(
          accountId,
          rawMessage,
          {
            resolvedRemoteJid: resolvedJid,
            displayName,
            incrementUnread,
          },
        );

        if (!normalized) return;

        const chat = this.inboxService.upsertChat(normalized.chat);
        const message = this.inboxService.saveMessage({
          ...normalized.message,
          chatId: chat.id,
        });

        this.eventBus.publish({
          type: 'chat-updated',
          accountId,
          chat,
        });

        this.eventBus.publish({
          type: 'message-created',
          accountId,
          message,
        });
      } catch (reason: unknown) {
        const message =
          reason instanceof Error ? reason.message : 'Bilinmeyen mesaj kayıt hatası.';
        console.error(`[Inbox] ${accountId} mesajı kaydedilemedi: ${message}`);
      }
    };

    const handleMessagesUpsert = (payload: MessagesUpsertPayload): void => {
      for (const rawMessage of payload.messages) {
        void processMessage(rawMessage, true);
      }
    };

    const handleMessagingHistory = (
      payload: MessagingHistoryPayload,
    ): void => {
      for (const contact of payload.contacts ?? []) {
        const name =
          contact.name ??
          contact.notify ??
          contact.verifiedName ??
          null;

        if (contact.id && name) {
          contactNames.set(contact.id, name);
        }
      }

      for (const chat of payload.chats ?? []) {
        if (chat.id && chat.name) {
          contactNames.set(chat.id, chat.name);
        }
      }

      const messages = payload.messages ?? [];

      console.log(
        `[Inbox] ${accountId} geçmiş senkronizasyonu: ${messages.length} mesaj, ilerleme=${payload.progress ?? '-'}, son=${payload.isLatest ?? '-'}`,
      );

      for (const rawMessage of messages) {
        void processMessage(rawMessage, false);
      }
    };

    const handleMessagesUpdate = (updates: MessageUpdateItem[]): void => {
      for (const item of updates) {
        const whatsappMessageId = item.key?.id;
        const status = mapBaileysStatus(item.update?.status);

        if (!whatsappMessageId || !status) continue;

        try {
          this.inboxService.updateMessageStatus(
            accountId,
            whatsappMessageId,
            status,
          );

          this.eventBus.publish({
            type: 'message-status-updated',
            accountId,
            whatsappMessageId,
            status,
          });
        } catch (reason: unknown) {
          const message =
            reason instanceof Error ? reason.message : 'Bilinmeyen durum güncelleme hatası.';
          console.error(`[Inbox] ${accountId} mesaj durumu güncellenemedi: ${message}`);
        }
      }
    };

    socket.ev.on('messages.upsert', handleMessagesUpsert);
    socket.ev.on('messages.update', handleMessagesUpdate);
    socket.ev.on('messaging-history.set', handleMessagingHistory);

    return () => {
      socket.ev.off('messages.upsert', handleMessagesUpsert);
      socket.ev.off('messages.update', handleMessagesUpdate);
      socket.ev.off('messaging-history.set', handleMessagingHistory);
    };
  }
}
