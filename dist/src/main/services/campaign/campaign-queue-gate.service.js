import { countCampaignRecipientsSentToday, } from '../../repositories/campaign-recipient-queue.repository.js';
import { millisecondsUntilCampaignWorkingWindow, millisecondsUntilNextCampaignDay, } from './campaign-timing.service.js';
export function getCampaignQueueGate(campaign) {
    const workingWait = millisecondsUntilCampaignWorkingWindow(campaign.settings.workStartTime, campaign.settings.workEndTime);
    if (workingWait > 0) {
        return {
            type: 'working-window',
            waitMs: workingWait,
        };
    }
    const dailyLimit = campaign.settings.dailyLimit;
    if (dailyLimit !== null &&
        dailyLimit > 0 &&
        countCampaignRecipientsSentToday(campaign.id) >= dailyLimit) {
        return {
            type: 'daily-limit',
            waitMs: millisecondsUntilNextCampaignDay(),
        };
    }
    return {
        type: 'ready',
        waitMs: 0,
    };
}
//# sourceMappingURL=campaign-queue-gate.service.js.map