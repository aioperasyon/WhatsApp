import { getDatabase } from '../../database/database.js';

function recoverInterruptedRecipientRows(): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const recoverTransaction = database.transaction(() => {
    database.prepare(`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = CASE
          WHEN error_message IS NULL OR TRIM(error_message) = ''
            THEN 'Uygulama kapanışı nedeniyle gönderim yeniden kuyruğa alındı.'
          ELSE error_message
        END,
        updated_at = ?
      WHERE status = 'sending'
    `).run(now);

    database.prepare(`
      UPDATE campaigns
      SET
        pending_count = (
          SELECT COUNT(*)
          FROM campaign_recipients
          WHERE
            campaign_recipients.campaign_id = campaigns.id
            AND campaign_recipients.status IN ('pending', 'sending')
        ),
        sent_count = (
          SELECT COUNT(*)
          FROM campaign_recipients
          WHERE
            campaign_recipients.campaign_id = campaigns.id
            AND campaign_recipients.status = 'sent'
        ),
        failed_count = (
          SELECT COUNT(*)
          FROM campaign_recipients
          WHERE
            campaign_recipients.campaign_id = campaigns.id
            AND campaign_recipients.status = 'failed'
        ),
        updated_at = ?
      WHERE EXISTS (
        SELECT 1
        FROM campaign_recipients
        WHERE campaign_recipients.campaign_id = campaigns.id
      )
    `).run(now);
  });

  recoverTransaction();
}

function recoverInterruptedCampaignStatuses(): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const recoverStatuses = database.transaction(() => {
    database.prepare(`
      UPDATE campaigns
      SET
        status = CASE
          WHEN EXISTS (
            SELECT 1
            FROM campaign_recipients
            WHERE
              campaign_recipients.campaign_id = campaigns.id
              AND campaign_recipients.status = 'pending'
          )
            THEN 'paused'
          WHEN EXISTS (
            SELECT 1
            FROM campaign_recipients
            WHERE
              campaign_recipients.campaign_id = campaigns.id
              AND campaign_recipients.status = 'failed'
          )
            THEN 'completed'
          ELSE 'completed'
        END,
        updated_at = ?
      WHERE status = 'running'
    `).run(now);

    database.prepare(`
      UPDATE campaigns
      SET
        status = 'completed',
        updated_at = ?
      WHERE
        status IN ('paused', 'ready')
        AND NOT EXISTS (
          SELECT 1
          FROM campaign_recipients
          WHERE
            campaign_recipients.campaign_id = campaigns.id
            AND campaign_recipients.status = 'pending'
        )
        AND EXISTS (
          SELECT 1
          FROM campaign_recipients
          WHERE campaign_recipients.campaign_id = campaigns.id
        )
    `).run(now);
  });

  recoverStatuses();
}

export function recoverInterruptedCampaigns(): void {
  recoverInterruptedRecipientRows();
  recoverInterruptedCampaignStatuses();

  const now = new Date().toISOString();

  getDatabase().prepare(`
    UPDATE campaign_recipients
    SET status = 'pending', updated_at = ?
    WHERE status = 'sending'
  `).run(now);

  getDatabase().prepare(`
    UPDATE campaigns
    SET status = 'paused', updated_at = ?
    WHERE status = 'running'
  `).run(now);
}
