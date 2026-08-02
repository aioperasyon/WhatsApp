import type {
  Campaign,
} from '../../../../shared/interfaces/campaign.js';
import {
  getCampaignById,
} from '../../repositories/campaign.repository.js';

export function readCampaign(
  campaignId: string,
): Campaign {
  const campaign = getCampaignById(campaignId);

  if (!campaign) {
    throw new Error('Kampanya bulunamadı.');
  }

  return campaign;
}
