import type {
  CampaignRecipientLog,
  CampaignRecipientLogRequest,
  CampaignRecipientLogSnapshot,
  CampaignRecipientStatus,
} from '../../../shared/interfaces/campaign.js';
import { getDatabase } from '../database/database.js';

interface CampaignRecipientRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  full_name: string;
  phone_number: string;
  status: CampaignRecipientStatus;
  attempt_count: number;
  error_message: string | null;
  whatsapp_message_id: string | null;
  sent_at: string | null;
  updated_at: string;
}

function mapCampaignRecipient(
  row: CampaignRecipientRow,
): CampaignRecipientLog {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    status: row.status,
    attemptCount: row.attempt_count,
    errorMessage: row.error_message,
    whatsappMessageId: row.whatsapp_message_id,
    sentAt: row.sent_at,
    updatedAt: row.updated_at,
  };
}

export function listCampaignRecipients(
  request: CampaignRecipientLogRequest,
): CampaignRecipientLogSnapshot {
  const campaignId = request.campaignId?.trim();

  if (!campaignId) {
    throw new Error('Kampanya kimliği zorunludur.');
  }

  const limit = Math.min(
    500,
    Math.max(1, request.limit ?? 100),
  );
  const offset = Math.max(0, request.offset ?? 0);
  const database = getDatabase();

  const totalRow = database
    .prepare(`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE campaign_id = ?
    `)
    .get(campaignId) as { total: number };

  const rows = database
    .prepare(`
      SELECT *
      FROM campaign_recipients
      WHERE campaign_id = ?
      ORDER BY
        CASE status
          WHEN 'sending' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'failed' THEN 3
          WHEN 'sent' THEN 4
          ELSE 5
        END,
        updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(
      campaignId,
      limit,
      offset,
    ) as CampaignRecipientRow[];

  return {
    recipients: rows.map(mapCampaignRecipient),
    total: Number(totalRow.total ?? 0),
  };
}
