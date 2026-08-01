import { randomUUID } from 'node:crypto';
import type {
  InboxChat,
  InboxChatListRequest,
  InboxChatReadRequest,
  InboxMessage,
  InboxMessageListRequest,
  InboxMessageStatus,
} from '../../../shared/interfaces/inbox.js';

interface Statement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}

interface InboxChatRow {
  id: string;
  account_id: string;
  jid: string;
  display_name: string | null;
  phone_number: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

interface InboxMessageRow {
  id: string;
  account_id: string;
  chat_id: string;
  remote_jid: string;
  whatsapp_message_id: string | null;
  direction: 'incoming' | 'outgoing';
  sender_jid: string | null;
  text: string | null;
  message_type: string;
  status: InboxMessageStatus;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertInboxChatInput {
  accountId: string;
  jid: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  incrementUnread?: boolean;
}

export interface SaveInboxMessageInput {
  id?: string;
  accountId: string;
  chatId: string;
  remoteJid: string;
  whatsappMessageId?: string | null;
  direction: 'incoming' | 'outgoing';
  senderJid?: string | null;
  text?: string | null;
  messageType: string;
  status: InboxMessageStatus;
  timestamp: string;
}

function mapChat(row: InboxChatRow): InboxChat {
  return {
    id: row.id,
    accountId: row.account_id,
    jid: row.jid,
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: InboxMessageRow): InboxMessage {
  return {
    id: row.id,
    accountId: row.account_id,
    chatId: row.chat_id,
    remoteJid: row.remote_jid,
    whatsappMessageId: row.whatsapp_message_id,
    direction: row.direction,
    senderJid: row.sender_jid,
    text: row.text,
    messageType: row.message_type,
    status: row.status,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class InboxRepository {
  constructor(private readonly database: SqliteDatabase) {}

  ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS inbox_chats (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        jid TEXT NOT NULL,
        display_name TEXT,
        phone_number TEXT,
        last_message_preview TEXT,
        last_message_at TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(account_id, jid)
      );

      CREATE INDEX IF NOT EXISTS idx_inbox_chats_account_last_message
      ON inbox_chats(account_id, last_message_at DESC);

      CREATE INDEX IF NOT EXISTS idx_inbox_chats_account_unread
      ON inbox_chats(account_id, unread_count, last_message_at DESC);

      CREATE INDEX IF NOT EXISTS idx_inbox_chats_account_phone
      ON inbox_chats(account_id, phone_number);

      CREATE TABLE IF NOT EXISTS inbox_messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        remote_jid TEXT NOT NULL,
        whatsapp_message_id TEXT,
        direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
        sender_jid TEXT,
        text TEXT,
        message_type TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(account_id, whatsapp_message_id)
      );

      CREATE INDEX IF NOT EXISTS idx_inbox_messages_chat_timestamp
      ON inbox_messages(account_id, chat_id, timestamp DESC);
    `);

    /*
     * Önceki sürümlerde Baileys'in geçici ACK değeri nedeniyle
     * "pending" olarak kalan, ancak WhatsApp tarafından kabul edilmiş
     * giden mesajları düzeltir.
     */
    this.database.prepare(`
      UPDATE inbox_messages
      SET status = 'sent', updated_at = ?
      WHERE direction = 'outgoing'
        AND status = 'pending'
        AND whatsapp_message_id IS NOT NULL
        AND TRIM(whatsapp_message_id) <> ''
    `).run(new Date().toISOString());
  }

  cleanupTechnicalMessages(): void {
    this.database.prepare(`
      DELETE FROM inbox_messages
      WHERE message_type IN (
        'protocolMessage',
        'senderKeyDistributionMessage',
        'messageContextInfo',
        'deviceSentMessage',
        'keepInChatMessage',
        'unknown'
      )
    `).run();

    this.database.prepare(`
      DELETE FROM inbox_chats
      WHERE NOT EXISTS (
        SELECT 1
        FROM inbox_messages
        WHERE inbox_messages.account_id = inbox_chats.account_id
          AND inbox_messages.chat_id = inbox_chats.id
      )
    `).run();

    this.database.prepare(`
      UPDATE inbox_chats
      SET
        last_message_preview = (
          SELECT COALESCE(
            inbox_messages.text,
            '[' || inbox_messages.message_type || ']'
          )
          FROM inbox_messages
          WHERE inbox_messages.account_id = inbox_chats.account_id
            AND inbox_messages.chat_id = inbox_chats.id
          ORDER BY inbox_messages.timestamp DESC
          LIMIT 1
        ),
        last_message_at = (
          SELECT inbox_messages.timestamp
          FROM inbox_messages
          WHERE inbox_messages.account_id = inbox_chats.account_id
            AND inbox_messages.chat_id = inbox_chats.id
          ORDER BY inbox_messages.timestamp DESC
          LIMIT 1
        ),
        updated_at = ?
    `).run(new Date().toISOString());
  }

  mergeChatIdentity(
    accountId: string,
    oldJid: string,
    newJid: string,
    phoneNumber: string | null,
  ): void {
    if (oldJid === newJid) return;

    const oldChat = this.database
      .prepare('SELECT * FROM inbox_chats WHERE account_id = ? AND jid = ?')
      .get(accountId, oldJid) as InboxChatRow | undefined;

    if (!oldChat) return;

    const targetChat = this.database
      .prepare('SELECT * FROM inbox_chats WHERE account_id = ? AND jid = ?')
      .get(accountId, newJid) as InboxChatRow | undefined;

    const now = new Date().toISOString();

    if (!targetChat) {
      this.database.prepare(`
        UPDATE inbox_chats
        SET jid = ?, phone_number = COALESCE(?, phone_number), updated_at = ?
        WHERE id = ? AND account_id = ?
      `).run(newJid, phoneNumber, now, oldChat.id, accountId);

      this.database.prepare(`
        UPDATE inbox_messages
        SET remote_jid = ?, updated_at = ?
        WHERE account_id = ? AND chat_id = ?
      `).run(newJid, now, accountId, oldChat.id);

      return;
    }

    this.database.prepare(`
      UPDATE inbox_messages
      SET chat_id = ?, remote_jid = ?, updated_at = ?
      WHERE account_id = ? AND chat_id = ?
    `).run(targetChat.id, newJid, now, accountId, oldChat.id);

    this.database.prepare(`
      UPDATE inbox_chats
      SET
        display_name = COALESCE(display_name, ?),
        phone_number = COALESCE(?, phone_number),
        unread_count = unread_count + ?,
        last_message_preview = CASE
          WHEN COALESCE(?, '') > COALESCE(last_message_at, '')
          THEN ?
          ELSE last_message_preview
        END,
        last_message_at = CASE
          WHEN COALESCE(?, '') > COALESCE(last_message_at, '')
          THEN ?
          ELSE last_message_at
        END,
        updated_at = ?
      WHERE id = ? AND account_id = ?
    `).run(
      oldChat.display_name,
      phoneNumber,
      oldChat.unread_count,
      oldChat.last_message_at,
      oldChat.last_message_preview,
      oldChat.last_message_at,
      oldChat.last_message_at,
      now,
      targetChat.id,
      accountId,
    );

    this.database
      .prepare('DELETE FROM inbox_chats WHERE id = ? AND account_id = ?')
      .run(oldChat.id, accountId);
  }

  upsertChat(input: UpsertInboxChatInput): InboxChat {
    const existing = this.database
      .prepare('SELECT * FROM inbox_chats WHERE account_id = ? AND jid = ?')
      .get(input.accountId, input.jid) as InboxChatRow | undefined;

    const now = new Date().toISOString();

    if (!existing) {
      const id = randomUUID();

      this.database.prepare(`
        INSERT INTO inbox_chats (
          id, account_id, jid, display_name, phone_number,
          last_message_preview, last_message_at, unread_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.accountId,
        input.jid,
        input.displayName ?? null,
        input.phoneNumber ?? null,
        input.lastMessagePreview ?? null,
        input.lastMessageAt ?? null,
        input.incrementUnread ? 1 : 0,
        now,
        now,
      );

      return this.getChatById(input.accountId, id);
    }

    this.database.prepare(`
      UPDATE inbox_chats
      SET
        display_name = COALESCE(?, display_name),
        phone_number = COALESCE(?, phone_number),
        last_message_preview = COALESCE(?, last_message_preview),
        last_message_at = COALESCE(?, last_message_at),
        unread_count = unread_count + ?,
        updated_at = ?
      WHERE id = ? AND account_id = ?
    `).run(
      input.displayName ?? null,
      input.phoneNumber ?? null,
      input.lastMessagePreview ?? null,
      input.lastMessageAt ?? null,
      input.incrementUnread ? 1 : 0,
      now,
      existing.id,
      input.accountId,
    );

    return this.getChatById(input.accountId, existing.id);
  }

  saveMessage(input: SaveInboxMessageInput): InboxMessage {
    if (input.whatsappMessageId) {
      const existing = this.database
        .prepare('SELECT * FROM inbox_messages WHERE account_id = ? AND whatsapp_message_id = ?')
        .get(input.accountId, input.whatsappMessageId) as InboxMessageRow | undefined;

      if (existing) return mapMessage(existing);
    }

    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();

    this.database.prepare(`
      INSERT INTO inbox_messages (
        id, account_id, chat_id, remote_jid, whatsapp_message_id,
        direction, sender_jid, text, message_type, status,
        timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.accountId,
      input.chatId,
      input.remoteJid,
      input.whatsappMessageId ?? null,
      input.direction,
      input.senderJid ?? null,
      input.text ?? null,
      input.messageType,
      input.status,
      input.timestamp,
      now,
      now,
    );

    return this.getMessageById(input.accountId, id);
  }

  listChats(request: InboxChatListRequest): { chats: InboxChat[]; total: number } {
    const search = request.search?.trim() ?? '';
    const unreadOnly = request.unreadOnly === true ? 1 : 0;
    const limit = Math.min(Math.max(request.limit ?? 50, 1), 200);
    const offset = Math.max(request.offset ?? 0, 0);
    const like = `%${search}%`;

    const rows = this.database.prepare(`
      SELECT *
      FROM inbox_chats
      WHERE account_id = ?
        AND (? = 0 OR unread_count > 0)
        AND (
          ? = ''
          OR COALESCE(display_name, '') LIKE ?
          OR COALESCE(phone_number, '') LIKE ?
          OR jid LIKE ?
          OR COALESCE(last_message_preview, '') LIKE ?
        )
      ORDER BY
        CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END,
        last_message_at DESC,
        updated_at DESC
      LIMIT ? OFFSET ?
    `).all(
      request.accountId,
      unreadOnly,
      search,
      like,
      like,
      like,
      like,
      limit,
      offset,
    ) as InboxChatRow[];

    const totalRow = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM inbox_chats
      WHERE account_id = ?
        AND (? = 0 OR unread_count > 0)
        AND (
          ? = ''
          OR COALESCE(display_name, '') LIKE ?
          OR COALESCE(phone_number, '') LIKE ?
          OR jid LIKE ?
          OR COALESCE(last_message_preview, '') LIKE ?
        )
    `).get(
      request.accountId,
      unreadOnly,
      search,
      like,
      like,
      like,
      like,
    ) as { count: number };

    return { chats: rows.map(mapChat), total: totalRow.count };
  }

  listMessages(request: InboxMessageListRequest): InboxMessage[] {
    const limit = Math.min(Math.max(request.limit ?? 100, 1), 300);

    if (request.before) {
      const rows = this.database.prepare(`
        SELECT *
        FROM inbox_messages
        WHERE account_id = ? AND chat_id = ? AND timestamp < ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(request.accountId, request.chatId, request.before, limit) as InboxMessageRow[];

      return rows.reverse().map(mapMessage);
    }

    const rows = this.database.prepare(`
      SELECT *
      FROM inbox_messages
      WHERE account_id = ? AND chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(request.accountId, request.chatId, limit) as InboxMessageRow[];

    return rows.reverse().map(mapMessage);
  }

  markChatRead(request: InboxChatReadRequest): InboxChat {
    this.database.prepare(`
      UPDATE inbox_chats
      SET unread_count = 0, updated_at = ?
      WHERE id = ? AND account_id = ?
    `).run(new Date().toISOString(), request.chatId, request.accountId);

    return this.getChatById(request.accountId, request.chatId);
  }

  updateMessageStatus(
    accountId: string,
    whatsappMessageId: string,
    status: InboxMessageStatus,
  ): void {
    this.database.prepare(`
      UPDATE inbox_messages
      SET status = ?, updated_at = ?
      WHERE account_id = ? AND whatsapp_message_id = ?
    `).run(status, new Date().toISOString(), accountId, whatsappMessageId);
  }

  private getChatById(accountId: string, chatId: string): InboxChat {
    const row = this.database
      .prepare('SELECT * FROM inbox_chats WHERE account_id = ? AND id = ?')
      .get(accountId, chatId) as InboxChatRow | undefined;

    if (!row) throw new Error('Sohbet kaydı bulunamadı.');
    return mapChat(row);
  }

  private getMessageById(accountId: string, messageId: string): InboxMessage {
    const row = this.database
      .prepare('SELECT * FROM inbox_messages WHERE account_id = ? AND id = ?')
      .get(accountId, messageId) as InboxMessageRow | undefined;

    if (!row) throw new Error('Mesaj kaydı bulunamadı.');
    return mapMessage(row);
  }
}
