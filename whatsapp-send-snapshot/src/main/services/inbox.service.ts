import type {
  InboxChat,
  InboxChatListRequest,
  InboxChatReadRequest,
  InboxMessage,
  InboxMessageListRequest,
  InboxSnapshot,
} from '../../../shared/interfaces/inbox.js';
import {
  InboxRepository,
  type SaveInboxMessageInput,
  type UpsertInboxChatInput,
} from '../repositories/inbox.repository.js';

interface InboxDeleteDatabase {
  prepare(sql: string): {
    run(...params: unknown[]): {
      changes?: number;
    };
  };
}

interface InboxRepositoryWithDatabase {
  database: InboxDeleteDatabase;
}



export class InboxService {
  constructor(private readonly repository: InboxRepository) {
    this.repository.ensureSchema();
  }

  listChats(request: InboxChatListRequest): InboxSnapshot {
    this.assertAccountId(request.accountId);
    return this.repository.listChats(request);
  }

  listMessages(request: InboxMessageListRequest): InboxMessage[] {
    this.assertAccountId(request.accountId);

    if (!request.chatId?.trim()) {
      throw new Error('Sohbet kimliği zorunludur.');
    }

    return this.repository.listMessages(request);
  }

  markChatRead(request: InboxChatReadRequest): InboxChat {
    this.assertAccountId(request.accountId);

    if (!request.chatId?.trim()) {
      throw new Error('Sohbet kimliği zorunludur.');
    }

    return this.repository.markChatRead(request);
  }

  upsertChat(input: UpsertInboxChatInput): InboxChat {
    this.assertAccountId(input.accountId);

    if (!input.jid?.trim()) {
      throw new Error('WhatsApp sohbet JID değeri zorunludur.');
    }

    return this.repository.upsertChat(input);
  }

  saveMessage(input: SaveInboxMessageInput): InboxMessage {
    this.assertAccountId(input.accountId);

    if (!input.chatId?.trim()) {
      throw new Error('Mesaj için sohbet kimliği zorunludur.');
    }

    if (!input.remoteJid?.trim()) {
      throw new Error('Mesaj için uzak JID değeri zorunludur.');
    }

    return this.repository.saveMessage(input);
  }

  updateMessageStatus(
    accountId: string,
    whatsappMessageId: string,
    status: InboxMessage['status'],
  ): void {
    this.assertAccountId(accountId);

    if (!whatsappMessageId?.trim()) {
      throw new Error('WhatsApp mesaj kimliği zorunludur.');
    }

    this.repository.updateMessageStatus(
      accountId,
      whatsappMessageId,
      status,
    );
  }



  mergeChatIdentity(
    accountId: string,
    oldJid: string,
    newJid: string,
    phoneNumber: string | null,
  ): void {
    this.assertAccountId(accountId);

    if (!oldJid?.trim() || !newJid?.trim()) {
      return;
    }

    this.repository.mergeChatIdentity(
      accountId,
      oldJid,
      newJid,
      phoneNumber,
    );
  }

  deleteChat(request: {
    accountId: string;
    chatId: string;
  }): { deleted: boolean } {
    this.assertAccountId(request.accountId);

    if (!request.chatId?.trim()) {
      throw new Error('Silinecek sohbet kimliği zorunludur.');
    }

    const repository = this.repository as unknown as InboxRepositoryWithDatabase;
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

  private assertAccountId(accountId: string): void {
    if (!accountId?.trim()) {
      throw new Error('WhatsApp hesap kimliği zorunludur.');
    }
  }
}
