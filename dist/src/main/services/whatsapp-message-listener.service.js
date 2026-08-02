function mapBaileysStatus(status) {
    if (status == null)
        return null;
    if (status >= 4)
        return 'read';
    if (status === 3)
        return 'delivered';
    if (status === 2)
        return 'sent';
    /*
     * Baileys 0 ve 1 durumlarını gönderim sırasında geçici olarak
     * yayınlayabilir. Mesaj sendMessage() tarafından kabul edildikten
     * ve messages.upsert ile "sent" kaydedildikten sonra bu geçici
     * durumların kaydı tekrar "pending" seviyesine düşürmesine izin
     * vermiyoruz.
     */
    return null;
}
function normalizePhoneJid(jid) {
    const user = jid.split('@')[0]?.split(':')[0] ?? jid;
    return `${user}@s.whatsapp.net`;
}
function phoneNumberFromJid(jid) {
    if (!jid.endsWith('@s.whatsapp.net'))
        return null;
    const number = jid.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') ?? '';
    return number || null;
}
export class WhatsAppMessageListenerService {
    inboxService;
    normalizer;
    eventBus;
    constructor(inboxService, normalizer, eventBus) {
        this.inboxService = inboxService;
        this.normalizer = normalizer;
        this.eventBus = eventBus;
    }
    attach(accountId, socket) {
        const contactNames = new Map();
        const resolveRemoteJid = async (rawMessage) => {
            const key = rawMessage.key;
            const keyWithAlternative = key;
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
                    const phoneJid = await socket.signalRepository?.lidMapping?.getPNForLID(originalJid);
                    if (phoneJid) {
                        return {
                            originalJid,
                            resolvedJid: normalizePhoneJid(phoneJid),
                        };
                    }
                }
                catch (reason) {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    console.warn(`[Inbox] ${accountId} LID eşleştirmesi yapılamadı: ${message}`);
                }
            }
            return {
                originalJid,
                resolvedJid: originalJid,
            };
        };
        const processMessage = async (rawMessage, incrementUnread) => {
            try {
                const { originalJid, resolvedJid } = await resolveRemoteJid(rawMessage);
                if (originalJid &&
                    resolvedJid &&
                    originalJid !== resolvedJid) {
                    this.inboxService.mergeChatIdentity(accountId, originalJid, resolvedJid, phoneNumberFromJid(resolvedJid));
                }
                const displayName = contactNames.get(resolvedJid) ??
                    contactNames.get(originalJid) ??
                    rawMessage.pushName ??
                    null;
                const normalized = this.normalizer.normalize(accountId, rawMessage, {
                    resolvedRemoteJid: resolvedJid,
                    displayName,
                    incrementUnread,
                });
                if (!normalized)
                    return;
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
            }
            catch (reason) {
                const message = reason instanceof Error ? reason.message : 'Bilinmeyen mesaj kayıt hatası.';
                console.error(`[Inbox] ${accountId} mesajı kaydedilemedi: ${message}`);
            }
        };
        const handleMessagesUpsert = (payload) => {
            for (const rawMessage of payload.messages) {
                void processMessage(rawMessage, true);
            }
        };
        const handleMessagingHistory = (payload) => {
            for (const contact of payload.contacts ?? []) {
                const name = contact.name ??
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
            console.log(`[Inbox] ${accountId} geçmiş senkronizasyonu: ${messages.length} mesaj, ilerleme=${payload.progress ?? '-'}, son=${payload.isLatest ?? '-'}`);
            for (const rawMessage of messages) {
                void processMessage(rawMessage, false);
            }
        };
        const handleMessagesUpdate = (updates) => {
            for (const item of updates) {
                const whatsappMessageId = item.key?.id;
                const status = mapBaileysStatus(item.update?.status);
                if (!whatsappMessageId || !status)
                    continue;
                try {
                    this.inboxService.updateMessageStatus(accountId, whatsappMessageId, status);
                    this.eventBus.publish({
                        type: 'message-status-updated',
                        accountId,
                        whatsappMessageId,
                        status,
                    });
                }
                catch (reason) {
                    const message = reason instanceof Error ? reason.message : 'Bilinmeyen durum güncelleme hatası.';
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
//# sourceMappingURL=whatsapp-message-listener.service.js.map