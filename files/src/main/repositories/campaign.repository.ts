import { randomUUID } from 'node:crypto';
import type {
  Campaign,
  CampaignAudienceRequest,
  CampaignDeleteRequest,
  CampaignDeleteResult,
  CampaignListRequest,
  CampaignSaveInput,
  CampaignSnapshot,
  CampaignStatus,
} from '../../../shared/interfaces/campaign.js';
import { getDatabase } from '../database/database.js';

interface CampaignRow {
  id: string;
  name: string;
  account_id: string | null;
  account_name: string | null;
  message: string;
  sectors_json: string;
  cities_json: string;
  only_allowed: number;
  estimated_recipients: number;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
  min_delay_seconds: number | null;
  max_delay_seconds: number | null;
  batch_size: number | null;
  batch_pause_min_seconds: number | null;
  batch_pause_max_seconds: number | null;
  daily_limit: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  typing_simulation: number | null;
  retry_count: number | null;
  scheduled_at: string | null;
}

function normalizeValues(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'tr'));
}

function parseValues(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    accountId: row.account_id,
    accountName: row.account_name,
    message: row.message,
    sectors: parseValues(row.sectors_json),
    cities: parseValues(row.cities_json),
    onlyAllowed: row.only_allowed === 1,
    estimatedRecipients: row.estimated_recipients,
    status: row.status,
    totalRecipients: row.total_recipients,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    pendingCount: row.pending_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: {
      description: row.description ?? null,
      minDelaySeconds: row.min_delay_seconds ?? 6,
      maxDelaySeconds: row.max_delay_seconds ?? 14,
      batchSize: row.batch_size ?? 30,
      batchPauseMinSeconds:
        row.batch_pause_min_seconds ?? 45,
      batchPauseMaxSeconds:
        row.batch_pause_max_seconds ?? 90,
      dailyLimit: row.daily_limit ?? null,
      workStartTime: row.work_start_time ?? '09:00',
      workEndTime: row.work_end_time ?? '18:30',
      typingSimulation: (row.typing_simulation ?? 1) === 1,
      retryCount: row.retry_count ?? 2,
      scheduledAt: row.scheduled_at ?? null,
    },
  };
}

function buildAudienceCountWhere(
  request: CampaignAudienceRequest,
): {
  sql: string;
  parameters: string[];
} {
  const sectors = normalizeValues(request.sectors);
  const cities = normalizeValues(request.cities);
  const where: string[] = [];
  const parameters: string[] = [];

  if (request.onlyAllowed !== false) {
    where.push(`permission_status = 'allowed'`);
  }

  if (sectors.length > 0) {
    where.push(
      `sector IN (${sectors.map(() => '?').join(', ')})`,
    );
    parameters.push(...sectors);
  }

  if (cities.length > 0) {
    where.push(
      `city IN (${cities.map(() => '?').join(', ')})`,
    );
    parameters.push(...cities);
  }

  return {
    sql:
      where.length > 0
        ? `WHERE ${where.join(' AND ')}`
        : '',
    parameters,
  };
}

function estimateRecipientCount(
  request: CampaignAudienceRequest,
): number {
  const built = buildAudienceCountWhere(request);
  const row = getDatabase()
    .prepare(`
      SELECT COUNT(*) AS total
      FROM crm_contacts
      ${built.sql}
    `)
    .get(...built.parameters) as { total: number };

  return Number(row.total ?? 0);
}

export function getCampaignById(
  campaignId: string,
): Campaign | null {
  const row = getDatabase()
    .prepare(`
      SELECT
        c.*,
        a.name AS account_name,
        s.description,
        s.min_delay_seconds,
        s.max_delay_seconds,
        s.batch_size,
        s.batch_pause_min_seconds,
        s.batch_pause_max_seconds,
        s.daily_limit,
        s.work_start_time,
        s.work_end_time,
        s.typing_simulation,
        s.retry_count,
        s.scheduled_at
      FROM campaigns c
      LEFT JOIN whatsapp_accounts a
        ON a.id = c.account_id
      LEFT JOIN campaign_settings s
        ON s.campaign_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `)
    .get(campaignId) as CampaignRow | undefined;

  return row ? mapCampaign(row) : null;
}

export function listCampaigns(
  request: CampaignListRequest = {},
): CampaignSnapshot {
  const search = request.search?.trim() ?? '';
  const limit = Math.min(
    100,
    Math.max(1, request.limit ?? 50),
  );
  const offset = Math.max(0, request.offset ?? 0);
  const parameters: Array<string | number> = [];
  let where = '';

  if (search) {
    where = 'WHERE c.name LIKE ? OR c.message LIKE ?';
    parameters.push(`%${search}%`, `%${search}%`);
  }

  const totalRow = getDatabase()
    .prepare(`
      SELECT COUNT(*) AS total
      FROM campaigns c
      ${where}
    `)
    .get(...parameters) as { total: number };

  const rows = getDatabase()
    .prepare(`
      SELECT
        c.*,
        a.name AS account_name,
        s.description,
        s.min_delay_seconds,
        s.max_delay_seconds,
        s.batch_size,
        s.batch_pause_min_seconds,
        s.batch_pause_max_seconds,
        s.daily_limit,
        s.work_start_time,
        s.work_end_time,
        s.typing_simulation,
        s.retry_count,
        s.scheduled_at
      FROM campaigns c
      LEFT JOIN whatsapp_accounts a
        ON a.id = c.account_id
      LEFT JOIN campaign_settings s
        ON s.campaign_id = c.id
      ${where}
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...parameters, limit, offset) as CampaignRow[];

  return {
    campaigns: rows.map(mapCampaign),
    total: Number(totalRow.total ?? 0),
  };
}

export function saveCampaign(
  input: CampaignSaveInput,
): Campaign {
  const name = input.name?.trim() ?? '';
  const message = input.message?.trim() ?? '';
  const accountId = input.accountId?.trim() || null;
  const sectors = normalizeValues(input.sectors);
  const cities = normalizeValues(input.cities);
  const onlyAllowed = input.onlyAllowed !== false;
  const status: 'draft' | 'ready' | 'scheduled' =
    input.status === 'ready' || input.status === 'scheduled'
      ? input.status
      : 'draft';

  const description = input.description?.trim() || null;
  const minDelaySeconds = Math.max(
    1,
    Math.min(
      3600,
      Math.trunc(input.minDelaySeconds ?? 6),
    ),
  );
  const maxDelaySeconds = Math.max(
    minDelaySeconds,
    Math.min(
      3600,
      Math.trunc(input.maxDelaySeconds ?? 14),
    ),
  );
  const batchSize = Math.max(
    0,
    Math.min(
      10000,
      Math.trunc(input.batchSize ?? 30),
    ),
  );
  const batchPauseMinSeconds = Math.max(
    0,
    Math.min(
      86400,
      Math.trunc(input.batchPauseMinSeconds ?? 45),
    ),
  );
  const batchPauseMaxSeconds = Math.max(
    batchPauseMinSeconds,
    Math.min(
      86400,
      Math.trunc(input.batchPauseMaxSeconds ?? 90),
    ),
  );
  const dailyLimit =
    input.dailyLimit && input.dailyLimit > 0
      ? Math.min(100000, Math.trunc(input.dailyLimit))
      : null;
  const workStartTime =
    input.workStartTime || '09:00';
  const workEndTime =
    input.workEndTime || '18:30';
  const typingSimulation =
    input.typingSimulation !== false;
  const retryCount = Math.max(
    0,
    Math.min(10, Math.trunc(input.retryCount ?? 2)),
  );
  const scheduledAt =
    input.scheduledAt?.trim() || null;

  if (!name) {
    throw new Error('Kampanya adı zorunludur.');
  }

  if (!message) {
    throw new Error('Kampanya mesajı zorunludur.');
  }

  if (message.length > 4096) {
    throw new Error(
      'Kampanya mesajı en fazla 4096 karakter olabilir.',
    );
  }

  if (
    (status === 'ready' || status === 'scheduled') &&
    !accountId
  ) {
    throw new Error(
      'Hazır veya planlanmış kampanya için WhatsApp hesabı seçin.',
    );
  }

  if (status === 'scheduled' && !scheduledAt) {
    throw new Error(
      'Planlanmış kampanya için tarih ve saat seçin.',
    );
  }

  const id = input.id?.trim() || randomUUID();
  const database = getDatabase();
  const existingRow = database
    .prepare(
      'SELECT status FROM campaigns WHERE id = ?',
    )
    .get(id) as
    | { status: CampaignStatus }
    | undefined;

  if (
    existingRow &&
    ['running', 'paused'].includes(existingRow.status)
  ) {
    throw new Error(
      'Çalışan veya duraklatılmış kampanya düzenlenemez.',
    );
  }

  const estimatedRecipients = estimateRecipientCount({
    sectors,
    cities,
    onlyAllowed,
  });
  const now = new Date().toISOString();

  const persist = database.transaction(() => {
    if (existingRow) {
      database.prepare(`
        UPDATE campaigns
        SET
          name = ?,
          account_id = ?,
          message = ?,
          sectors_json = ?,
          cities_json = ?,
          only_allowed = ?,
          estimated_recipients = ?,
          status = ?,
          total_recipients = 0,
          sent_count = 0,
          failed_count = 0,
          pending_count = 0,
          started_at = NULL,
          completed_at = NULL,
          updated_at = ?
        WHERE id = ?
      `).run(
        name,
        accountId,
        message,
        JSON.stringify(sectors),
        JSON.stringify(cities),
        onlyAllowed ? 1 : 0,
        estimatedRecipients,
        status,
        now,
        id,
      );
    } else {
      database.prepare(`
        INSERT INTO campaigns (
          id,
          name,
          account_id,
          message,
          sectors_json,
          cities_json,
          only_allowed,
          estimated_recipients,
          status,
          total_recipients,
          sent_count,
          failed_count,
          pending_count,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          0, 0, 0, 0, NULL, NULL, ?, ?
        )
      `).run(
        id,
        name,
        accountId,
        message,
        JSON.stringify(sectors),
        JSON.stringify(cities),
        onlyAllowed ? 1 : 0,
        estimatedRecipients,
        status,
        now,
        now,
      );
    }

    database.prepare(`
      INSERT INTO campaign_settings (
        campaign_id,
        description,
        min_delay_seconds,
        max_delay_seconds,
        batch_size,
        batch_pause_min_seconds,
        batch_pause_max_seconds,
        daily_limit,
        work_start_time,
        work_end_time,
        typing_simulation,
        retry_count,
        scheduled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET
        description = excluded.description,
        min_delay_seconds = excluded.min_delay_seconds,
        max_delay_seconds = excluded.max_delay_seconds,
        batch_size = excluded.batch_size,
        batch_pause_min_seconds =
          excluded.batch_pause_min_seconds,
        batch_pause_max_seconds =
          excluded.batch_pause_max_seconds,
        daily_limit = excluded.daily_limit,
        work_start_time = excluded.work_start_time,
        work_end_time = excluded.work_end_time,
        typing_simulation = excluded.typing_simulation,
        retry_count = excluded.retry_count,
        scheduled_at = excluded.scheduled_at
    `).run(
      id,
      description,
      minDelaySeconds,
      maxDelaySeconds,
      batchSize,
      batchPauseMinSeconds,
      batchPauseMaxSeconds,
      dailyLimit,
      workStartTime,
      workEndTime,
      typingSimulation ? 1 : 0,
      retryCount,
      scheduledAt,
    );

    if (existingRow) {
      database.prepare(`
        DELETE FROM campaign_recipients
        WHERE campaign_id = ?
      `).run(id);
    }
  });

  persist();

  const campaign = getCampaignById(id);

  if (!campaign) {
    throw new Error(
      'Kaydedilen kampanya yeniden okunamadı.',
    );
  }

  return campaign;
}

export function deleteCampaign(
  request: CampaignDeleteRequest,
): CampaignDeleteResult {
  const campaign = getCampaignById(request.id);

  if (
    campaign &&
    ['running', 'paused'].includes(campaign.status)
  ) {
    throw new Error(
      'Çalışan veya duraklatılmış kampanya silinemez.',
    );
  }

  const result = getDatabase()
    .prepare('DELETE FROM campaigns WHERE id = ?')
    .run(request.id);

  return {
    deleted: result.changes > 0,
  };
}
