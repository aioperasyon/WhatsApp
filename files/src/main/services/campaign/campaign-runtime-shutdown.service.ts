import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';
import {
  wakeCampaignRuntime,
} from './campaign-runtime-wait.service.js';

export function pauseAllCampaignRuntimes(
  runtimeStates: Map<string, CampaignRuntimeState>,
): void {
  for (const state of runtimeStates.values()) {
    state.paused = true;
    wakeCampaignRuntime(state);
  }
}

export async function waitForCampaignRuntimesToStop(input: {
  runtimeStates: Map<string, CampaignRuntimeState>;
  timeoutMs: number;
}): Promise<string[]> {
  const {
    runtimeStates,
    timeoutMs,
  } = input;

  const deadline =
    Date.now() + Math.max(1000, timeoutMs);

  while (
    Array.from(runtimeStates.values()).some(
      (state) => state.running,
    ) &&
    Date.now() < deadline
  ) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return Array.from(runtimeStates.entries())
    .filter(([, state]) => state.running)
    .map(([campaignId]) => campaignId);
}

export function resetCampaignRuntimes(
  runtimeStates: Map<string, CampaignRuntimeState>,
): void {
  for (const state of runtimeStates.values()) {
    state.running = false;
    state.wakeWait = undefined;
  }

  runtimeStates.clear();
}
