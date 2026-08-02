import type {
  Campaign,
} from '../../../../shared/interfaces/campaign.js';
import {
  getCampaignBatchSize,
} from './campaign-delivery-policy.service.js';
import {
  randomCampaignInteger,
} from './campaign-timing.service.js';

export interface CampaignPostSendDelay {
  sentSinceBatchPause: number;
  waitMs: number;
}

export function getCampaignPostSendDelay(input: {
  campaign: Campaign;
  sentSuccessfully: boolean;
  sentSinceBatchPause: number;
}): CampaignPostSendDelay {
  const {
    campaign,
    sentSuccessfully,
  } = input;

  let sentSinceBatchPause =
    input.sentSinceBatchPause;

  if (sentSuccessfully) {
    sentSinceBatchPause += 1;
  }

  const batchSize = getCampaignBatchSize(
    campaign.settings.batchSize,
  );

  if (sentSinceBatchPause >= batchSize) {
    const batchPauseSeconds =
      randomCampaignInteger(
        campaign.settings.batchPauseMinSeconds,
        campaign.settings.batchPauseMaxSeconds,
      );

    return {
      sentSinceBatchPause: 0,
      waitMs: batchPauseSeconds * 1000,
    };
  }

  const delaySeconds =
    randomCampaignInteger(
      campaign.settings.minDelaySeconds,
      campaign.settings.maxDelaySeconds,
    );

  return {
    sentSinceBatchPause,
    waitMs: delaySeconds * 1000,
  };
}
