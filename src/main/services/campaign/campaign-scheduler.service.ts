import { getDatabase } from '../../database/database.js';

interface ScheduledCampaignRow {
  id: string;
  scheduled_at: string;
}

export interface CampaignSchedulerDependencies {
  isShuttingDown: () => boolean;
  startCampaign: (campaignId: string) => unknown;
  clearFinishedRuntimeStates: () => void;
}

const SCHEDULER_INTERVAL_MS = 30000;

let campaignSchedulerTimer: NodeJS.Timeout | null = null;
let campaignSchedulerRunning = false;
let campaignSchedulerGeneration = 0;

const scheduledCampaignClaims = new Set<string>();

export async function processScheduledCampaigns(
  dependencies: CampaignSchedulerDependencies,
): Promise<void> {
  if (
    dependencies.isShuttingDown() ||
    campaignSchedulerRunning
  ) {
    return;
  }

  campaignSchedulerRunning = true;

  try {
    const now = Date.now();
    const rows = getDatabase()
      .prepare(`
        SELECT
          c.id,
          s.scheduled_at
        FROM campaigns c
        INNER JOIN campaign_settings s
          ON s.campaign_id = c.id
        WHERE
          c.status IN ('ready', 'scheduled')
          AND s.scheduled_at IS NOT NULL
          AND TRIM(s.scheduled_at) <> ''
        ORDER BY s.scheduled_at ASC
      `)
      .all() as ScheduledCampaignRow[];

    for (const row of rows) {
      if (scheduledCampaignClaims.has(row.id)) {
        continue;
      }

      const scheduledTime = Date.parse(
        row.scheduled_at,
      );

      if (!Number.isFinite(scheduledTime)) {
        console.error(
          `[Campaign Scheduler] Geçersiz planlama tarihi: ${row.id} / ${row.scheduled_at}`,
        );
        continue;
      }

      if (scheduledTime > now) {
        continue;
      }

      scheduledCampaignClaims.add(row.id);

      try {
        dependencies.startCampaign(row.id);
      } catch (reason: unknown) {
        const message =
          reason instanceof Error
            ? reason.message
            : 'Planlanan kampanya başlatılamadı.';

        console.error(
          `[Campaign Scheduler] ${row.id}: ${message}`,
        );
      } finally {
        scheduledCampaignClaims.delete(row.id);
      }
    }
  } finally {
    campaignSchedulerRunning = false;
  }
}

async function runCampaignSchedulerTick(
  dependencies: CampaignSchedulerDependencies,
): Promise<void> {
  const schedulerGeneration =
    campaignSchedulerGeneration;

  try {
    await processScheduledCampaigns(dependencies);

    if (
      schedulerGeneration !==
      campaignSchedulerGeneration
    ) {
      return;
    }
  } catch (reason: unknown) {
    const message =
      reason instanceof Error
        ? reason.message
        : 'Bilinmeyen scheduler hatası.';

    console.error(
      `[Campaign Scheduler] Tarama başarısız: ${message}`,
    );
  }
}

export function startCampaignScheduler(
  dependencies: CampaignSchedulerDependencies,
): void {
  if (
    dependencies.isShuttingDown() ||
    campaignSchedulerTimer
  ) {
    return;
  }

  campaignSchedulerGeneration += 1;

  void runCampaignSchedulerTick(dependencies);

  campaignSchedulerTimer = setInterval(() => {
    void runCampaignSchedulerTick(dependencies);
  }, SCHEDULER_INTERVAL_MS);

  campaignSchedulerTimer.unref?.();
}

export function stopCampaignScheduler(
  clearFinishedRuntimeStates: () => void,
): void {
  if (campaignSchedulerTimer) {
    clearInterval(campaignSchedulerTimer);
    campaignSchedulerTimer = null;
  }

  clearFinishedRuntimeStates();

  campaignSchedulerGeneration += 1;
  campaignSchedulerRunning = false;
  scheduledCampaignClaims.clear();
}

export function restartCampaignScheduler(
  dependencies: CampaignSchedulerDependencies,
): void {
  stopCampaignScheduler(
    dependencies.clearFinishedRuntimeStates,
  );
  startCampaignScheduler(dependencies);
}
