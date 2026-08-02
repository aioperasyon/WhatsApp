export function getCampaignMaximumAttempts(retryCount) {
    return 1 + Math.max(0, retryCount);
}
export function getCampaignRetryWaitSeconds(currentAttempt) {
    return Math.min(30, Math.max(3, currentAttempt * 5));
}
export function getCampaignBatchSize(batchSize) {
    return Math.max(1, batchSize);
}
//# sourceMappingURL=campaign-delivery-policy.service.js.map