import type {
  CampaignStatus,
} from '../../../../shared/interfaces/campaign.js';
import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';
import {
  isTerminalCampaignStatus,
} from './campaign-status-policy.service.js';

export function removeFinishedCampaignRuntimeState(input: {
  campaignId: string;
  state: CampaignRuntimeState;
  getStatus: (campaignId: string) => string | null;
  deleteState: (campaignId: string) => void;
}): void {
  const {
    campaignId,
    state,
    getStatus,
    deleteState,
  } = input;

  const status = getStatus(campaignId);

  if (
    status === null ||
    isTerminalCampaignStatus(
      status as CampaignStatus,
    )
  ) {
    state.wakeWait = undefined;
    deleteState(campaignId);
  }
}
