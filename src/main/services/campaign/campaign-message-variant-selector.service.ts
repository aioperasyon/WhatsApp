import type {
  Campaign,
} from '../../../../shared/interfaces/campaign.js';

function stableStringHash(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (
      Math.imul(hash, 31) +
      value.charCodeAt(index)
    ) >>> 0;
  }

  return hash;
}

export function selectCampaignMessageVariant(input: {
  campaign: Campaign;
  recipientId: string;
}): string {
  const variants = (
    input.campaign.messageVariants?.length
      ? input.campaign.messageVariants
      : [input.campaign.message]
  )
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (variants.length === 0) {
    throw new Error(
      'Kampanyada gönderilecek geçerli mesaj kalıbı bulunamadı.',
    );
  }

  const index =
    stableStringHash(input.recipientId) %
    variants.length;

  return variants[index]!;
}
