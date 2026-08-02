import {
  getCampaignStatus,
} from '../../repositories/campaign-state.repository.js';
import {
  getCampaignErrorMessage,
} from './campaign-error-policy.service.js';
import {
  removeFinishedCampaignRuntimeState,
} from './campaign-runtime-cleanup.service.js';
import type {
  CampaignRuntimeState,
} from './campaign-runtime-state.service.js';

export function clearFinishedCampaignRuntimes(
  runtimeStates: Map<string, CampaignRuntimeState>,
): void {
  for (
    const [campaignId, state]
    of runtimeStates.entries()
  ) {
    if (state.running) {
      continue;
    }

    try {
      removeFinishedCampaignRuntimeState({
        campaignId,
        state,
        getStatus: getCampaignStatus,
        deleteState: (id) =>
          runtimeStates.delete(id),
      });
    } catch (reason: unknown) {
      const message =
        getCampaignErrorMessage(
          reason,
          'Runtime temizliği başarısız.',
        );

      console.error(
        `[Campaign Queue] ${campaignId}: ${message}`,
      );
    }
  }
}
