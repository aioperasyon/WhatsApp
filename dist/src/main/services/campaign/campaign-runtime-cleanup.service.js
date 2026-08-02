import { isTerminalCampaignStatus, } from './campaign-status-policy.service.js';
export function removeFinishedCampaignRuntimeState(input) {
    const { campaignId, state, getStatus, deleteState, } = input;
    const status = getStatus(campaignId);
    if (status === null ||
        isTerminalCampaignStatus(status)) {
        state.wakeWait = undefined;
        deleteState(campaignId);
    }
}
//# sourceMappingURL=campaign-runtime-cleanup.service.js.map