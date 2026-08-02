import type {
  CampaignStatus,
} from '../../../../shared/interfaces/campaign.js';

const TERMINAL_CAMPAIGN_STATUSES:
  readonly CampaignStatus[] = [
    'completed',
    'cancelled',
    'failed',
  ];

const STARTABLE_CAMPAIGN_STATUSES:
  readonly CampaignStatus[] = [
    'ready',
    'scheduled',
    'paused',
    'failed',
  ];

export function isTerminalCampaignStatus(
  status: CampaignStatus,
): boolean {
  return TERMINAL_CAMPAIGN_STATUSES.includes(status);
}

export function isStartableCampaignStatus(
  status: CampaignStatus,
): boolean {
  return STARTABLE_CAMPAIGN_STATUSES.includes(status);
}

export function getStartableCampaignStatuses():
  readonly CampaignStatus[] {
  return STARTABLE_CAMPAIGN_STATUSES;
}
