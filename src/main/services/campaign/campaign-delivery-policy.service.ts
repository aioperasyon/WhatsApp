export function getCampaignMaximumAttempts(
  retryCount: number,
): number {
  return 1 + Math.max(0, retryCount);
}

export function getCampaignRetryWaitSeconds(
  currentAttempt: number,
): number {
  return Math.min(
    30,
    Math.max(3, currentAttempt * 5),
  );
}

export function getCampaignBatchSize(
  batchSize: number,
): number {
  return Math.max(1, batchSize);
}
