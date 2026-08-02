const TERMINAL_CAMPAIGN_STATUSES = [
    'completed',
    'cancelled',
    'failed',
];
const STARTABLE_CAMPAIGN_STATUSES = [
    'ready',
    'scheduled',
    'paused',
    'failed',
];
export function isTerminalCampaignStatus(status) {
    return TERMINAL_CAMPAIGN_STATUSES.includes(status);
}
export function isStartableCampaignStatus(status) {
    return STARTABLE_CAMPAIGN_STATUSES.includes(status);
}
export function getStartableCampaignStatuses() {
    return STARTABLE_CAMPAIGN_STATUSES;
}
//# sourceMappingURL=campaign-status-policy.service.js.map