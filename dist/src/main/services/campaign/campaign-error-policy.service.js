export function getCampaignErrorMessage(reason, fallback) {
    return reason instanceof Error
        ? reason.message
        : fallback;
}
export function formatCampaignRetryError(currentAttempt, maximumAttempts, errorMessage) {
    return `Tekrar denenecek (${currentAttempt}/${maximumAttempts - 1}): ${errorMessage}`;
}
//# sourceMappingURL=campaign-error-policy.service.js.map