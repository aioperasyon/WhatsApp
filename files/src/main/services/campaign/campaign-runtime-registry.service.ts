import { randomUUID } from 'node:crypto';

export interface CampaignRuntimeState {
  cancelled: boolean;
  paused: boolean;
  running: boolean;
  runId: string;
  wakeWait?: () => void;
}

const runtimeStates =
  new Map<string, CampaignRuntimeState>();

export function getCampaignRuntimeState(
  campaignId: string,
): CampaignRuntimeState | undefined {
  return runtimeStates.get(campaignId);
}

export function setCampaignRuntimeState(
  campaignId: string,
  state: CampaignRuntimeState,
): void {
  runtimeStates.set(campaignId, state);
}

export function deleteCampaignRuntimeState(
  campaignId: string,
): void {
  runtimeStates.delete(campaignId);
}

export function clearCampaignRuntimeStates(): void {
  runtimeStates.clear();
}

export function listCampaignRuntimeEntries(): Array<
  [string, CampaignRuntimeState]
> {
  return Array.from(runtimeStates.entries());
}

export function listCampaignRuntimeStates(): CampaignRuntimeState[] {
  return Array.from(runtimeStates.values());
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
  campaignId: string,
): CampaignRuntimeState {
  const existingState =
    getCampaignRuntimeState(campaignId);

  const state =
    existingState && !existingState.running
      ? existingState
      : createCampaignRuntimeState();

  state.cancelled = false;
  state.paused = false;
  state.runId = randomUUID();

  setCampaignRuntimeState(
    campaignId,
    state,
  );

  return state;
}

export function getOrCreateCampaignRuntimeState(
  campaignId: string,
): CampaignRuntimeState {
  const existing =
    getCampaignRuntimeState(campaignId);

  if (existing) {
    return existing;
  }

  const state = createCampaignRuntimeState();

  setCampaignRuntimeState(
    campaignId,
    state,
  );

  return state;
}
