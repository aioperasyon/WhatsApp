import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';

export function canStartCampaignRuntime(
  state: CampaignRuntimeState | undefined,
  expectedRunId: string,
): state is CampaignRuntimeState {
  return Boolean(
    state &&
    !state.running &&
    state.runId === expectedRunId,
  );
}

export function ownsCampaignRuntime(
  currentState: CampaignRuntimeState | undefined,
  expectedState: CampaignRuntimeState,
  expectedRunId: string,
): boolean {
  return (
    currentState === expectedState &&
    expectedState.runId === expectedRunId
  );
}
