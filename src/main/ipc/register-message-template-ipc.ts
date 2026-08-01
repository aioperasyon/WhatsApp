import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type {
  MessageTemplate,
  MessageTemplateDeleteRequest,
  MessageTemplateListRequest,
  MessageTemplateMarkUsedRequest,
  MessageTemplateMarkUsedResult,
  MessageTemplateSaveInput,
} from '../../../shared/interfaces/message-template.js';
import { getDatabase } from '../database/database.js';

interface MessageTemplateRow {
  id: string;
  name: string;
  category: string | null;
  content: string;
  is_favorite: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const channels = {
  list: 'message-templates:list',
  save: 'message-templates:save',
  delete: 'message-templates:delete',
  markUsed: 'message-templates:mark-used',
} as const;

function hasColumn(columnName: string): boolean {
  const columns = getDatabase()
    .prepare('PRAGMA table_info(message_templates)')
    .all() as Array<{ name: string }>;

  return columns.some((column) => column.name === columnName);
}

function ensureSchema(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      content TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  if (!hasColumn('is_favorite')) {
    getDatabase().exec(
      'ALTER TABLE message_templates ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0',
    );
  }

  if (!hasColumn('usage_count')) {
    getDatabase().exec(
      'ALTER TABLE message_templates ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0',
    );
  }

  if (!hasColumn('last_used_at')) {
    getDatabase().exec(
      'ALTER TABLE message_templates ADD COLUMN last_used_at TEXT',
    );
  }

  getDatabase().exec(`
    CREATE INDEX IF NOT EXISTS idx_message_templates_updated_at
      ON message_templates(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_message_templates_favorite
      ON message_templates(is_favorite DESC, updated_at DESC);
  `);
}

function mapRow(row: MessageTemplateRow): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    content: row.content,
    isFavorite: row.is_favorite === 1,
    usageCount: row.usage_count ?? 0,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listTemplates(
  request: MessageTemplateListRequest = {},
): MessageTemplate[] {
  ensureSchema();

  const search = request.search?.trim() ?? '';

  if (!search) {
    return (
      getDatabase()
        .prepare(`
          SELECT *
          FROM message_templates
          ORDER BY is_favorite DESC, updated_at DESC
        `)
        .all() as MessageTemplateRow[]
    ).map(mapRow);
  }

  return (
    getDatabase()
      .prepare(`
        SELECT *
        FROM message_templates
        WHERE name LIKE ? OR category LIKE ? OR content LIKE ?
        ORDER BY is_favorite DESC, updated_at DESC
      `)
      .all(`%${search}%`, `%${search}%`, `%${search}%`) as MessageTemplateRow[]
  ).map(mapRow);
}

function saveTemplate(
  input: MessageTemplateSaveInput,
): MessageTemplate {
  ensureSchema();

  const name = input.name?.trim() ?? '';
  const category = input.category?.trim() || null;
  const content = input.content?.trim() ?? '';

  if (!name) {
    throw new Error('Şablon adı zorunludur.');
  }

  if (!content) {
    throw new Error('Şablon mesajı zorunludur.');
  }

  if (content.length > 4096) {
    throw new Error('Şablon mesajı en fazla 4096 karakter olabilir.');
  }

  const id = input.id?.trim() || randomUUID();
  const now = new Date().toISOString();
  const existing = getDatabase()
    .prepare(`
      SELECT id, is_favorite
      FROM message_templates
      WHERE id = ?
    `)
    .get(id) as { id: string; is_favorite: number } | undefined;

  const isFavorite = input.isFavorite === undefined
    ? existing?.is_favorite ?? 0
    : input.isFavorite
      ? 1
      : 0;

  if (existing) {
    getDatabase()
      .prepare(`
        UPDATE message_templates
        SET
          name = ?,
          category = ?,
          content = ?,
          is_favorite = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(name, category, content, isFavorite, now, id);
  } else {
    getDatabase()
      .prepare(`
        INSERT INTO message_templates (
          id,
          name,
          category,
          content,
          is_favorite,
          usage_count,
          last_used_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
      `)
      .run(id, name, category, content, isFavorite, now, now);
  }

  const row = getDatabase()
    .prepare('SELECT * FROM message_templates WHERE id = ?')
    .get(id) as MessageTemplateRow;

  return mapRow(row);
}

function deleteTemplate(
  request: MessageTemplateDeleteRequest,
): { deleted: boolean } {
  ensureSchema();

  const result = getDatabase()
    .prepare('DELETE FROM message_templates WHERE id = ?')
    .run(request.id);

  return { deleted: result.changes > 0 };
}

function markTemplateUsed(
  request: MessageTemplateMarkUsedRequest,
): MessageTemplateMarkUsedResult {
  ensureSchema();

  const id = request.id?.trim() ?? '';
  if (!id) {
    throw new Error('Şablon kimliği zorunludur.');
  }

  const now = new Date().toISOString();
  const result = getDatabase()
    .prepare(`
      UPDATE message_templates
      SET
        usage_count = usage_count + 1,
        last_used_at = ?,
        updated_at = updated_at
      WHERE id = ?
    `)
    .run(now, id);

  if (result.changes === 0) {
    return {
      updated: false,
      usageCount: 0,
      lastUsedAt: null,
    };
  }

  const row = getDatabase()
    .prepare(`
      SELECT usage_count, last_used_at
      FROM message_templates
      WHERE id = ?
    `)
    .get(id) as {
      usage_count: number;
      last_used_at: string | null;
    };

  return {
    updated: true,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  };
}

export function registerMessageTemplateIpcHandlers(): void {
  ensureSchema();

  Object.values(channels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });

  ipcMain.handle(channels.list, (_event, request) =>
    listTemplates(request),
  );
  ipcMain.handle(channels.save, (_event, input) =>
    saveTemplate(input),
  );
  ipcMain.handle(channels.delete, (_event, request) =>
    deleteTemplate(request),
  );
  ipcMain.handle(channels.markUsed, (_event, request) =>
    markTemplateUsed(request),
  );
}
