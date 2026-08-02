import type {
  CampaignActionResult,
} from '../../../../shared/interfaces/campaign.js';
import type {
  CampaignSchedulerDependencies,
} from './campaign-scheduler.service.js';

export interface CampaignSchedulerDependencyInput {
  isShuttingDown: () => boolean;
  startCampaign: (
    campaignId: string,
  ) => CampaignActionResult;
  clearFinishedRuntimeStates: () => void;
}

export function createCampaignSchedulerDependencies(
  input: CampaignSchedulerDependencyInput,
): CampaignSchedulerDependencies {
  return {
    isShuttingDown:
      input.isShuttingDown,
    startCampaign:
      input.startCampaign,
    clearFinishedRuntimeStates:
      input.clearFinishedRuntimeStates,
  };
}
