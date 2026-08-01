import { randomUUID } from 'node:crypto';
import type {
  Campaign,
} from '../../../shared/interfaces/campaign.js';
import { getDatabase } from '../database/database.js';

function buildAudienceQuery(campaign: Campaign): {
  sql: string;
  parameters: string[];
} {
  const where: string[] = [];
  const parameters: string[] = [];

  if (campaign.onlyAllowed) {
    where.push(`permission_status = 'allowed'`);
  }

  if (campaign.sectors.length > 0) {
    where.push(
      `sector IN (${campaign.sectors.map(() => '?').join(', ')})`,
    );
    parameters.push(...campaign.sectors);
  }

  if (campaign.cities.length > 0) {
    where.push(
      `city IN (${campaign.cities.map(() => '?').join(', ')})`,
    );
    parameters.push(...campaign.cities);
  }

  return {
    sql:
      where.length > 0
        ? `WHERE ${where.join(' AND ')}`
        : '',
    parameters,
  };
}

export function countCampaignRecipientsSentToday(
  campaignId: string,
): number {
  const row = getDatabase()
    .prepare(`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE
        campaign_id = ?
        AND status = 'sent'
        AND date(sent_at, 'localtime') =
          date('now', 'localtime')
    `)
    .get(campaignId) as { total: number };

  return Number(row.total ?? 0);
}

export function seedCampaignRecipients(
  campaign: Campaign,
): void {
  const database = getDatabase();
  const existing = database
    .prepare(`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE campaign_id = ?
    `)
    .get(campaign.id) as { total: number };

  if (Number(existing.total ?? 0) > 0) {
    return;
  }

  const built = buildAudienceQuery(campaign);
  const contacts = database
    .prepare(`
      SELECT
        id,
        full_name,
        phone_number
      FROM crm_contacts
      ${built.sql}
      ORDER BY created_at ASC
    `)
    .all(...built.parameters) as Array<{
      id: string;
      full_name: string;
      phone_number: string;
    }>;

  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT INTO campaign_recipients (
      id,
      campaign_id,
      contact_id,
      full_name,
      phone_number,
      status,
      attempt_count,
      error_message,
      whatsapp_message_id,
      sent_at,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      'pending',
      0,
      NULL,
      NULL,
      NULL,
      ?,
      ?
    )
  `);

  const transaction = database.transaction(() => {
    for (const contact of contacts) {
      insert.run(
        randomUUID(),
        campaign.id,
        contact.id,
        contact.full_name,
        contact.phone_number,
        now,
        now,
      );
    }

    database.prepare(`
      UPDATE campaigns
      SET
        total_recipients = ?,
        pending_count = ?,
        sent_count = 0,
        failed_count = 0,
        updated_at = ?
      WHERE id = ?
    `).run(
      contacts.length,
      contacts.length,
      now,
      campaign.id,
    );
  });

  transaction();
}

export function refreshCampaignRecipientCounts(
  campaignId: string,
): void {
  const database = getDatabase();
  const counts = database
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN status = 'sent'
              THEN 1
            ELSE 0
          END
        ) AS sent,
        SUM(
          CASE
            WHEN status = 'failed'
              THEN 1
            ELSE 0
          END
        ) AS failed,
        SUM(
          CASE
            WHEN status IN ('pending', 'sending')
              THEN 1
            ELSE 0
          END
        ) AS pending
      FROM campaign_recipients
      WHERE campaign_id = ?
    `)
    .get(campaignId) as {
      total: number;
      sent: number | null;
      failed: number | null;
      pending: number | null;
    };

  database.prepare(`
    UPDATE campaigns
    SET
      total_recipients = ?,
      sent_count = ?,
      failed_count = ?,
      pending_count = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    Number(counts.total ?? 0),
    Number(counts.sent ?? 0),
    Number(counts.failed ?? 0),
    Number(counts.pending ?? 0),
    new Date().toISOString(),
    campaignId,
  );
}
