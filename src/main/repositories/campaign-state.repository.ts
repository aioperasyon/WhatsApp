import type {
  CampaignStatus,
} from '../../../shared/interfaces/campaign.js';
import { getDatabase } from '../database/database.js';

export function claimCampaignStart(
  campaignId: string,
  allowedStatuses: readonly CampaignStatus[],
): boolean {
  if (allowedStatuses.length === 0) {
    return false;
  }

  const placeholders = allowedStatuses
    .map(() => '?')
    .join(', ');
  const now = new Date().toISOString();

  const result = getDatabase()
    .prepare(`
      UPDATE campaigns
      SET
        status = 'running',
        started_at = COALESCE(started_at, ?),
        completed_at = NULL,
        updated_at = ?
      WHERE
        id = ?
        AND status IN (${placeholders})
    `)
    .run(
      now,
      now,
      campaignId,
      ...allowedStatuses,
    );

  return result.changes === 1;
}

export function completeCampaign(
  campaignId: string,
  completedAt = new Date().toISOString(),
): void {
  getDatabase()
    .prepare(`
      UPDATE campaigns
      SET
        status = 'completed',
        completed_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      completedAt,
      completedAt,
      campaignId,
    );
}

export function reconcileCampaignState(
  campaignId: string,
): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const reconcile = database.transaction(() => {
    const counts = database
      .prepare(`
        SELECT
          SUM(
            CASE
              WHEN status IN ('pending', 'sending')
                THEN 1
              ELSE 0
            END
          ) AS pending_count,
          SUM(
            CASE
              WHEN status = 'sent'
                THEN 1
              ELSE 0
            END
          ) AS sent_count,
          SUM(
            CASE
              WHEN status = 'failed'
                THEN 1
              ELSE 0
            END
          ) AS failed_count,
          COUNT(*) AS total_count
        FROM campaign_recipients
        WHERE campaign_id = ?
      `)
      .get(campaignId) as {
        pending_count: number | null;
        sent_count: number | null;
        failed_count: number | null;
        total_count: number;
      };

    const pendingCount = Number(
      counts.pending_count ?? 0,
    );
    const sentCount = Number(
      counts.sent_count ?? 0,
    );
    const failedCount = Number(
      counts.failed_count ?? 0,
    );
    const totalCount = Number(
      counts.total_count ?? 0,
    );

    database
      .prepare(`
        UPDATE campaigns
        SET
          pending_count = ?,
          sent_count = ?,
          failed_count = ?,
          status = CASE
            WHEN status = 'cancelled'
              THEN 'cancelled'
            WHEN ? > 0
              THEN status
            WHEN ? = 0
              THEN status
            ELSE 'completed'
          END,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        pendingCount,
        sentCount,
        failedCount,
        pendingCount,
        totalCount,
        now,
        campaignId,
      );
  });

  reconcile();
}

export function getCampaignStatus(
  campaignId: string,
): string | null {
  const row = getDatabase()
    .prepare(`
      SELECT status
      FROM campaigns
      WHERE id = ?
      LIMIT 1
    `)
    .get(campaignId) as
    | { status: string }
    | undefined;

  return row?.status ?? null;
}
