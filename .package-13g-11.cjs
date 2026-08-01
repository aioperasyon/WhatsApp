const fs = require('fs');
const path = require('path');

const files = {
  ipc: 'src/main/ipc/register-campaign-ipc.ts',
  migrations: 'src/main/database/migrations/run-migrations.ts',
  schema: 'src/main/database/schema/campaign-schema.ts',
};

function requireFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Dosya bulunamadı: ${file}`);
  }
}

function backup(file) {
  fs.copyFileSync(file, `${file}.before-package-13g-11.bak`);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${label} için beklenen eşleşme sayısı 1, bulunan: ${count}`);
  }
  return source.replace(search, replacement);
}

function removeFunction(source, signature, label) {
  const start = source.indexOf(signature);
  if (start === -1) {
    throw new Error(`${label} başlangıcı bulunamadı.`);
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`${label} açılış süslü parantezi bulunamadı.`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quote) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '/' && next === '/') {
      const lineEnd = source.indexOf('\n', index + 2);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      if (commentEnd === -1) {
        throw new Error(`${label} içinde kapanmayan yorum bulundu.`);
      }
      index = commentEnd + 1;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (end < source.length && (source[end] === '\r' || source[end] === '\n')) {
          end += 1;
        }
        return source.slice(0, start) + source.slice(end);
      }
    }
  }

  throw new Error(`${label} kapanış süslü parantezi bulunamadı.`);
}

requireFile(files.ipc);
requireFile(files.migrations);
backup(files.ipc);
backup(files.migrations);

if (fs.existsSync(files.schema)) {
  backup(files.schema);
}

fs.mkdirSync(path.dirname(files.schema), { recursive: true });

const campaignSchema = `import type Database from 'better-sqlite3';

export const CAMPAIGN_SCHEMA_SQL = \`
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_id TEXT,
  message TEXT NOT NULL,
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
\`;

export function ensureCampaignDatabaseSchema(
  database: Database.Database,
): void {
  database.exec(CAMPAIGN_SCHEMA_SQL);

  const campaignColumns = database
    .prepare('PRAGMA table_info(campaigns)')
    .all() as Array<{ name: string }>;

  const existing = new Set(
    campaignColumns.map((column) => column.name),
  );

  const additions: Array<[string, string]> = [
    ['total_recipients', 'INTEGER NOT NULL DEFAULT 0'],
    ['sent_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['failed_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['pending_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['started_at', 'TEXT'],
    ['completed_at', 'TEXT'],
  ];

  for (const [name, definition] of additions) {
    if (!existing.has(name)) {
      database.exec(
        \`ALTER TABLE campaigns ADD COLUMN \${name} \${definition}\`,
      );
    }
  }
}
`;

fs.writeFileSync(files.schema, campaignSchema, 'utf8');

let migrations = fs.readFileSync(files.migrations, 'utf8');

migrations = replaceOnce(
  migrations,
  `import { INITIAL_SCHEMA_SQL } from '../schema/initial-schema.js';`,
  `import { INITIAL_SCHEMA_SQL } from '../schema/initial-schema.js';
import {
  ensureCampaignDatabaseSchema,
} from '../schema/campaign-schema.js';`,
  'campaign schema migration import',
);

migrations = replaceOnce(
  migrations,
  `const SCHEMA_VERSION = 1;`,
  `const SCHEMA_VERSION = 2;`,
  'schema version',
);

migrations = replaceOnce(
  migrations,
  `  const migrate = database.transaction(() => {
    database.exec(INITIAL_SCHEMA_SQL);
    database.pragma(\`user_version = \${SCHEMA_VERSION}\`);
  });`,
  `  const migrate = database.transaction(() => {
    if (currentVersion < 1) {
      database.exec(INITIAL_SCHEMA_SQL);
    }

    if (currentVersion < 2) {
      ensureCampaignDatabaseSchema(database);
    }

    database.pragma(\`user_version = \${SCHEMA_VERSION}\`);
  });`,
  'versioned migration body',
);

fs.writeFileSync(files.migrations, migrations, 'utf8');

let ipc = fs.readFileSync(files.ipc, 'utf8');

ipc = removeFunction(
  ipc,
  'function ensureCampaignSchema(): void',
  'ensureCampaignSchema',
);

ipc = replaceOnce(
  ipc,
  '  ensureCampaignSchema();',
  '  recoverInterruptedCampaigns();',
  'IPC campaign schema bootstrap call',
);

if (ipc.includes('function ensureCampaignSchema')) {
  throw new Error('IPC dosyasındaki ensureCampaignSchema fonksiyonu kaldırılamadı.');
}

fs.writeFileSync(files.ipc, ipc, 'utf8');

console.log('13G-11 kaynak değişiklikleri uygulandı.');
