export const INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  session_path TEXT NOT NULL,
  last_connected_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  whatsapp_jid TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  profile_name TEXT,
  notes TEXT,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  UNIQUE (account_id, whatsapp_jid)
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  contact_id TEXT,
  whatsapp_jid TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'individual',
  title TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  UNIQUE (account_id, whatsapp_jid)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  whatsapp_message_id TEXT,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  UNIQUE (account_id, whatsapp_message_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_account_id
  ON contacts(account_id);

CREATE INDEX IF NOT EXISTS idx_chats_account_last_message
  ON chats(account_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
  ON messages(chat_id, created_at DESC);
`;
//# sourceMappingURL=initial-schema.js.map