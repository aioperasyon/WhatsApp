import { getCampaignById, } from '../../repositories/campaign.repository.js';
export function readCampaign(campaignId) {
    const campaign = getCampaignById(campaignId);
    if (!campaign) {
        throw new Error('Kampanya bulunamadı.');
    }
    return campaign;
}
//# sourceMappingURL=campaign-reader.service.js.map