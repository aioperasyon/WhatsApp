import { randomUUID } from 'node:crypto';

export interface CampaignRuntimeState {
  cancelled: boolean;
  paused: boolean;
  running: boolean;
  runId: string;
  wakeWait?: () => void;
}

export function createCampaignRuntimeState(): CampaignRuntimeState {
  return {
    cancelled: false,
    paused: false,
    running: false,
    runId: randomUUID(),
  };
}

export function prepareCampaignRuntimeState(
  existingState?: CampaignRuntimeState,
): CampaignRuntimeState {
  const state =
    existingState && !existingState.running
      ? existingState
      : createCampaignRuntimeState();

  state.cancelled = false;
  state.paused = false;
  state.runId = randomUUID();

  return state;
}
