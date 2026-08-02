import {
  persistCampaignShutdownState,
} from './campaign-shutdown-persistence.service.js';
import {
  pauseAllCampaignRuntimes,
  resetCampaignRuntimes,
  waitForCampaignRuntimesToStop,
} from './campaign-runtime-shutdown.service.js';
import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';

export async function shutdownCampaignRuntimeEngine(input: {
  runtimeStates: Map<string, CampaignRuntimeState>;
  timeoutMs: number;
  stopScheduler: () => void;
}): Promise<void> {
  const {
    runtimeStates,
    timeoutMs,
    stopScheduler,
  } = input;

  stopScheduler();

  pauseAllCampaignRuntimes(
    runtimeStates,
  );

  const stillRunning =
    await waitForCampaignRuntimesToStop({
      runtimeStates,
      timeoutMs,
    });

  if (stillRunning.length > 0) {
    console.warn(
      `[Campaign Engine] Kapanış zaman aşımı. Devam eden worker sayısı: ${stillRunning.length}. Kampanyalar güvenli kurtarma durumuna alınacak.`,
    );
  }

  persistCampaignShutdownState();

  resetCampaignRuntimes(
    runtimeStates,
  );
}
