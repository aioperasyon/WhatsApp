import { claimCampaignRecipient, markCampaignRecipientFailed, markCampaignRecipientPending, markCampaignRecipientSent, } from '../../repositories/campaign-recipient-lifecycle.repository.js';
import { getCampaignMaximumAttempts, getCampaignRetryWaitSeconds, } from './campaign-delivery-policy.service.js';
import { formatCampaignRetryError, getCampaignErrorMessage, } from './campaign-error-policy.service.js';
import { waitForCampaignRuntime, } from './campaign-runtime-wait.service.js';
import { sendCampaignMessage, } from '../whatsapp-connection.service.js';
import { selectCampaignMessageVariant, } from './campaign-message-variant-selector.service.js';
export async function processCampaignRecipient(input) {
    const { campaign, recipient, state } = input;
    const maximumAttempts = getCampaignMaximumAttempts(campaign.settings.retryCount);
    let sentSuccessfully = false;
    let recipientClaimed = false;
    let lastErrorMessage = null;
    for (let currentAttempt = 1; currentAttempt <= maximumAttempts; currentAttempt += 1) {
        if (state.cancelled || state.paused) {
            markCampaignRecipientPending(recipient.id, new Date().toISOString());
            break;
        }
        const attemptStartedAt = new Date().toISOString();
        const recipientClaimSucceeded = claimCampaignRecipient(recipient.id, attemptStartedAt);
        if (!recipientClaimSucceeded) {
            console.warn(`[Campaign Queue] ${campaign.id}: Alıcı başka bir işlem tarafından alınmış olabilir: ${recipient.id}`);
            break;
        }
        recipientClaimed = true;
        try {
            const result = await sendCampaignMessage({
                accountId: campaign.accountId,
                phoneNumber: recipient.phone_number,
                text: selectCampaignMessageVariant({
                    campaign,
                    recipientId: recipient.id,
                }),
                typingSimulation: campaign.settings.typingSimulation,
            });
            const sentAt = result.sentAt ??
                new Date().toISOString();
            markCampaignRecipientSent({
                recipientId: recipient.id,
                whatsappMessageId: result.whatsappMessageId,
                sentAt,
            });
            sentSuccessfully = true;
            lastErrorMessage = null;
            break;
        }
        catch (reason) {
            lastErrorMessage =
                getCampaignErrorMessage(reason, 'Bilinmeyen gönderim hatası.');
            const hasAnotherAttempt = currentAttempt < maximumAttempts;
            if (!hasAnotherAttempt) {
                markCampaignRecipientFailed(recipient.id, lastErrorMessage, new Date().toISOString());
                break;
            }
            markCampaignRecipientPending(recipient.id, new Date().toISOString(), formatCampaignRetryError(currentAttempt, maximumAttempts, lastErrorMessage));
            const retryWaitSeconds = getCampaignRetryWaitSeconds(currentAttempt);
            const continued = await waitForCampaignRuntime(state, retryWaitSeconds * 1000);
            if (!continued) {
                markCampaignRecipientPending(recipient.id, new Date().toISOString());
                break;
            }
        }
    }
    return {
        recipientClaimed,
        sentSuccessfully,
    };
}
//# sourceMappingURL=campaign-recipient-processor.service.js.map