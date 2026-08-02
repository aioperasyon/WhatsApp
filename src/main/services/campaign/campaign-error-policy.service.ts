export function getCampaignErrorMessage(
  reason: unknown,
  fallback: string,
): string {
  return reason instanceof Error
    ? reason.message
    : fallback;
}

export function formatCampaignRetryError(
  currentAttempt: number,
  maximumAttempts: number,
  errorMessage: string,
): string {
  return `Tekrar denenecek (${currentAttempt}/${maximumAttempts - 1}): ${errorMessage}`;
}
