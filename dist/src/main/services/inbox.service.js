export class InboxService {
    repository;
    constructor(repository) {
        this.repository = repository;
        this.repository.ensureSchema();
    }
    listChats(request) {
        this.assertAccountId(request.accountId);
        return this.repository.listChats(request);
    }
    listMessages(request) {
        this.assertAccountId(request.accountId);
        if (!request.chatId?.trim()) {
            throw new Error('Sohbet kimliği zorunludur.');
        }
        return this.repository.listMessages(request);
    }
    markChatRead(request) {
        this.assertAccountId(request.accountId);
        if (!request.chatId?.trim()) {
            throw new Error('Sohbet kimliği zorunludur.');
        }
        return this.repository.markChatRead(request);
    }
    upsertChat(input) {
        this.assertAccountId(input.accountId);
        if (!input.jid?.trim()) {
            throw new Error('WhatsApp sohbet JID değeri zorunludur.');
        }
        return this.repository.upsertChat(input);
    }
    saveMessage(input) {
        this.assertAccountId(input.accountId);
        if (!input.chatId?.trim()) {
            throw new Error('Mesaj için sohbet kimliği zorunludur.');
        }
        if (!input.remoteJid?.trim()) {
            throw new Error('Mesaj için uzak JID değeri zorunludur.');
        }
        return this.repository.saveMessage(input);
    }
    updateMessageStatus(accountId, whatsappMessageId, status) {
        this.assertAccountId(accountId);
        if (!whatsappMessageId?.trim()) {
            throw new Error('WhatsApp mesaj kimliği zorunludur.');
        }
        this.repository.updateMessageStatus(accountId, whatsappMessageId, status);
    }
    mergeChatIdentity(accountId, oldJid, newJid, phoneNumber) {
        this.assertAccountId(accountId);
        if (!oldJid?.trim() || !newJid?.trim()) {
            return;
        }
        this.repository.mergeChatIdentity(accountId, oldJid, newJid, phoneNumber);
    }
    getChatDeleteContext(request) {
        this.assertAccountId(request.accountId);
        if (!request.chatId?.trim()) {
            throw new Error('Silinecek sohbet kimliği zorunludur.');
        }
        const repository = this.repository;
        const database = repository.database;
        const chat = database.prepare(`
      SELECT jid
      FROM inbox_chats
      WHERE account_id = ? AND id = ?
      LIMIT 1
    `).get(request.accountId, request.chatId);
        if (!chat?.jid?.trim()) {
            throw new Error('Silinecek WhatsApp sohbeti bulunamadı.');
        }
        const lastMessage = database.prepare(`
      SELECT
        whatsapp_message_id AS whatsappMessageId,
        direction,
        timestamp
      FROM inbox_messages
      WHERE account_id = ?
        AND chat_id = ?
        AND whatsapp_message_id IS NOT NULL
        AND TRIM(whatsapp_message_id) <> ''
      ORDER BY timestamp DESC, created_at DESC
      LIMIT 1
    `).get(request.accountId, request.chatId);
        if (!lastMessage?.whatsappMessageId?.trim()) {
            throw new Error('WhatsApp sohbetini silmek için son mesaj bilgisi bulunamadı.');
        }
        const parsedTimestamp = new Date(lastMessage.timestamp ?? '').getTime();
        if (!Number.isFinite(parsedTimestamp)) {
            throw new Error('WhatsApp sohbetini silmek için mesaj tarihi okunamadı.');
        }
        return {
            accountId: request.accountId,
            chatId: request.chatId,
            jid: chat.jid,
            lastMessage: {
                id: lastMessage.whatsappMessageId,
                fromMe: lastMessage.direction === 'outgoing',
                timestamp: Math.floor(parsedTimestamp / 1000),
            },
        };
    }
    deleteChat(request) {
        this.assertAccountId(request.accountId);
        if (!request.chatId?.trim()) {
            throw new Error('Silinecek sohbet kimliği zorunludur.');
        }
        const repository = this.repository;
        const database = repository.database;
        database.prepare(`
      DELETE FROM inbox_messages
      WHERE account_id = ? AND chat_id = ?
    `).run(request.accountId, request.chatId);
        const result = database.prepare(`
      DELETE FROM inbox_chats
      WHERE account_id = ? AND id = ?
    `).run(request.accountId, request.chatId);
        return {
            deleted: (result.changes ?? 0) > 0,
        };
    }
    assertAccountId(accountId) {
        if (!accountId?.trim()) {
            throw new Error('WhatsApp hesap kimliği zorunludur.');
        }
    }
}
//# sourceMappingURL=inbox.service.js.map