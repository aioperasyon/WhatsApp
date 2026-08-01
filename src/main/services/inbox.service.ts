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
    get(...params: unknown[]): unknown;
  };
}

export interface InboxChatDeleteContext {
  accountId: string;
  chatId: string;
  jid: string;
  lastMessage: {
    id: string;
    fromMe: boolean;
    timestamp: number;
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


  getChatDeleteContext(request: {
    accountId: string;
    chatId: string;
  }): InboxChatDeleteContext {
    this.assertAccountId(request.accountId);

    if (!request.chatId?.trim()) {
      throw new Error('Silinecek sohbet kimliği zorunludur.');
    }

    const repository =
      this.repository as unknown as InboxRepositoryWithDatabase;
    const database = repository.database;

    const chat = database.prepare(`
      SELECT jid
      FROM inbox_chats
      WHERE account_id = ? AND id = ?
      LIMIT 1
    `).get(request.accountId, request.chatId) as
      | { jid?: string | null }
      | undefined;

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
    `).get(request.accountId, request.chatId) as
      | {
          whatsappMessageId?: string | null;
          direction?: string | null;
          timestamp?: string | null;
        }
      | undefined;

    if (!lastMessage?.whatsappMessageId?.trim()) {
      throw new Error(
        'WhatsApp sohbetini silmek için son mesaj bilgisi bulunamadı.',
      );
    }

    const parsedTimestamp = new Date(
      lastMessage.timestamp ?? '',
    ).getTime();

    if (!Number.isFinite(parsedTimestamp)) {
      throw new Error(
        'WhatsApp sohbetini silmek için mesaj tarihi okunamadı.',
      );
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
