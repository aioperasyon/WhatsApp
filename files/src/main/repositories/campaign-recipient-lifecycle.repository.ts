import type {
  CampaignRecipientStatus,
} from '../../../shared/interfaces/campaign.js';
import { getDatabase } from '../database/database.js';

export interface CampaignQueueRecipient {
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

export function findNextPendingCampaignRecipient(
  campaignId: string,
): CampaignQueueRecipient | null {
  const row = getDatabase()
    .prepare(`
      SELECT *
      FROM campaign_recipients
      WHERE
        campaign_id = ?
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `)
    .get(campaignId) as
    | CampaignQueueRecipient
    | undefined;

  return row ?? null;
}

export function claimCampaignRecipient(
  recipientId: string,
  claimedAt: string,
): boolean {
  const result = getDatabase()
    .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'sending',
        attempt_count = attempt_count + 1,
        error_message = NULL,
        updated_at = ?
      WHERE
        id = ?
        AND status = 'pending'
    `)
    .run(claimedAt, recipientId);

  return result.changes === 1;
}

export function markCampaignRecipientPending(
  recipientId: string,
  updatedAt: string,
  errorMessage: string | null = null,
): void {
  getDatabase()
    .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      errorMessage,
      updatedAt,
      recipientId,
    );
}

export function markCampaignRecipientSent(input: {
  recipientId: string;
  whatsappMessageId: string | null;
  sentAt: string;
}): void {
  getDatabase()
    .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'sent',
        error_message = NULL,
        whatsapp_message_id = ?,
        sent_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      input.whatsappMessageId,
      input.sentAt,
      input.sentAt,
      input.recipientId,
    );
}

export function markCampaignRecipientFailed(
  recipientId: string,
  errorMessage: string,
  updatedAt: string,
): void {
  getDatabase()
    .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'failed',
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      errorMessage,
      updatedAt,
      recipientId,
    );
}

export function countPendingCampaignRecipients(
  campaignId: string,
): number {
  const row = getDatabase()
    .prepare(`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE
        campaign_id = ?
        AND status = 'pending'
    `)
    .get(campaignId) as { total: number };

  return Number(row.total ?? 0);
}
