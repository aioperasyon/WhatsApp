import { getDatabase } from '../database/database.js';
export function pauseCampaignRecord(campaignId, updatedAt = new Date().toISOString()) {
    const result = getDatabase().prepare(`
    UPDATE campaigns
    SET status = 'paused', updated_at = ?
    WHERE id = ? AND status = 'running'
  `).run(updatedAt, campaignId);
    return result.changes === 1;
}
export function resumeCampaignRecord(campaignId, updatedAt = new Date().toISOString()) {
    const result = getDatabase().prepare(`
    UPDATE campaigns
    SET status = 'running', completed_at = NULL, updated_at = ?
    WHERE id = ? AND status = 'paused'
  `).run(updatedAt, campaignId);
    return result.changes === 1;
}
export function cancelCampaignRecord(campaignId, cancelledAt = new Date().toISOString()) {
    const database = getDatabase();
    const transaction = database.transaction(() => {
        database.prepare(`
      UPDATE campaign_recipients
      SET status = 'cancelled', updated_at = ?
      WHERE campaign_id = ?
        AND status IN ('pending', 'sending')
    `).run(cancelledAt, campaignId);
        database.prepare(`
      UPDATE campaigns
      SET status = 'cancelled', completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(cancelledAt, cancelledAt, campaignId);
    });
    transaction();
}
export function failCampaignRecord(campaignId, updatedAt = new Date().toISOString()) {
    getDatabase().prepare(`
    UPDATE campaigns
    SET status = 'failed', updated_at = ?
    WHERE id = ?
  `).run(updatedAt, campaignId);
}
//# sourceMappingURL=campaign-control.repository.js.map