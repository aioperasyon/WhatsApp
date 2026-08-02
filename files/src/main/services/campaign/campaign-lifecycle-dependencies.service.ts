import type {
  CampaignLifecycleDependencies,
} from './campaign-lifecycle.service.js';
import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';

export interface CampaignLifecycleDependencyInput {
  runtimeStates:
    Map<string, CampaignRuntimeState>;
  isShuttingDown: () => boolean;
  runQueue: (
    campaignId: string,
    expectedRunId: string,
  ) => Promise<void>;
}

export function createCampaignLifecycleDependencies(
  input: CampaignLifecycleDependencyInput,
): CampaignLifecycleDependencies {
  return {
    runtimeStates:
      input.runtimeStates,
    isShuttingDown:
      input.isShuttingDown,
    runQueue:
      input.runQueue,
  };
}
