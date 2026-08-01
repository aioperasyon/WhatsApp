import { getDatabase } from '../../database/database.js';

export function persistCampaignShutdownState(): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const persistShutdownState = database.transaction(() => {
    database.prepare(`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = CASE
          WHEN error_message IS NULL OR TRIM(error_message) = ''
            THEN 'Uygulama kontrollü kapandığı için gönderim yeniden kuyruğa alındı.'
          ELSE error_message
        END,
        updated_at = ?
      WHERE status = 'sending'
    `).run(now);

    database.prepare(`
      UPDATE campaigns
      SET
        status = 'paused',
        updated_at = ?
      WHERE status = 'running'
    `).run(now);
  });

  persistShutdownState();
}
