import { getDatabase } from '../database/database.js';
export function findNextPendingCampaignRecipient(campaignId) {
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
        .get(campaignId);
    return row ?? null;
}
export function claimCampaignRecipient(recipientId, claimedAt) {
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
export function markCampaignRecipientPending(recipientId, updatedAt, errorMessage = null) {
    getDatabase()
        .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `)
        .run(errorMessage, updatedAt, recipientId);
}
export function markCampaignRecipientSent(input) {
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
        .run(input.whatsappMessageId, input.sentAt, input.sentAt, input.recipientId);
}
export function markCampaignRecipientFailed(recipientId, errorMessage, updatedAt) {
    getDatabase()
        .prepare(`
      UPDATE campaign_recipients
      SET
        status = 'failed',
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `)
        .run(errorMessage, updatedAt, recipientId);
}
export function countPendingCampaignRecipients(campaignId) {
    const row = getDatabase()
        .prepare(`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE
        campaign_id = ?
        AND status = 'pending'
    `)
        .get(campaignId);
    return Number(row.total ?? 0);
}
//# sourceMappingURL=campaign-recipient-lifecycle.repository.js.map