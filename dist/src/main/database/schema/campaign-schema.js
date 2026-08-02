export const CAMPAIGN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_id TEXT,
  message TEXT NOT NULL,
  message_variants_json TEXT NOT NULL DEFAULT '[]',
  sectors_json TEXT NOT NULL DEFAULT '[]',
  cities_json TEXT NOT NULL DEFAULT '[]',
  only_allowed INTEGER NOT NULL DEFAULT 1,
  estimated_recipients INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id)
    REFERENCES whatsapp_accounts(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS campaign_settings (
  campaign_id TEXT PRIMARY KEY,
  description TEXT,
  min_delay_seconds INTEGER NOT NULL DEFAULT 6,
  max_delay_seconds INTEGER NOT NULL DEFAULT 14,
  batch_size INTEGER NOT NULL DEFAULT 30,
  batch_pause_min_seconds INTEGER NOT NULL DEFAULT 45,
  batch_pause_max_seconds INTEGER NOT NULL DEFAULT 90,
  daily_limit INTEGER,
  work_start_time TEXT NOT NULL DEFAULT '09:00',
  work_end_time TEXT NOT NULL DEFAULT '18:30',
  typing_simulation INTEGER NOT NULL DEFAULT 1,
  retry_count INTEGER NOT NULL DEFAULT 2,
  scheduled_at TEXT,
  FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  whatsapp_message_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_updated_at
  ON campaigns(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON campaigns(status);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON campaign_recipients(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_settings_campaign
  ON campaign_settings(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_active_queue
  ON campaign_recipients(campaign_id, id)
  WHERE status IN ('pending', 'sending');

CREATE INDEX IF NOT EXISTS idx_campaigns_active_status
  ON campaigns(status, updated_at)
  WHERE status IN ('running', 'paused', 'scheduled');
`;
export function ensureCampaignDatabaseSchema(database) {
    database.exec(CAMPAIGN_SCHEMA_SQL);
    const campaignColumns = database
        .prepare('PRAGMA table_info(campaigns)')
        .all();
    const existing = new Set(campaignColumns.map((column) => column.name));
    const additions = [
        ['message_variants_json', "TEXT NOT NULL DEFAULT '[]'"],
        ['total_recipients', 'INTEGER NOT NULL DEFAULT 0'],
        ['sent_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['failed_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['pending_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['started_at', 'TEXT'],
        ['completed_at', 'TEXT'],
    ];
    for (const [name, definition] of additions) {
        if (!existing.has(name)) {
            database.exec(`ALTER TABLE campaigns ADD COLUMN ${name} ${definition}`);
        }
    }
}
//# sourceMappingURL=campaign-schema.js.map