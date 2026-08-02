import type {
  Campaign,
} from '../../../../shared/interfaces/campaign.js';
import {
  countCampaignRecipientsSentToday,
} from '../../repositories/campaign-recipient-queue.repository.js';
import {
  millisecondsUntilCampaignWorkingWindow,
  millisecondsUntilNextCampaignDay,
} from './campaign-timing.service.js';

export type CampaignQueueGate =
  | {
      type: 'ready';
      waitMs: 0;
    }
  | {
      type: 'working-window';
      waitMs: number;
    }
  | {
      type: 'daily-limit';
      waitMs: number;
    };

export function getCampaignQueueGate(
  campaign: Campaign,
): CampaignQueueGate {
  const workingWait =
    millisecondsUntilCampaignWorkingWindow(
      campaign.settings.workStartTime,
      campaign.settings.workEndTime,
    );

  if (workingWait > 0) {
    return {
      type: 'working-window',
      waitMs: workingWait,
    };
  }

  const dailyLimit =
    campaign.settings.dailyLimit;

  if (
    dailyLimit !== null &&
    dailyLimit > 0 &&
    countCampaignRecipientsSentToday(
      campaign.id,
    ) >= dailyLimit
  ) {
    return {
      type: 'daily-limit',
      waitMs:
        millisecondsUntilNextCampaignDay(),
    };
  }

  return {
    type: 'ready',
    waitMs: 0,
  };
}
