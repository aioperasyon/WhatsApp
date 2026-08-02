import { failCampaignRecord } from '../../repositories/campaign-control.repository.js';
import { completeCampaign, getCampaignStatus, reconcileCampaignState } from '../../repositories/campaign-state.repository.js';
import { refreshCampaignRecipientCounts } from '../../repositories/campaign-recipient-queue.repository.js';
import { findNextPendingCampaignRecipient } from '../../repositories/campaign-recipient-lifecycle.repository.js';
import { getCampaignErrorMessage } from './campaign-error-policy.service.js';
import { canStartCampaignRuntime, ownsCampaignRuntime } from './campaign-runtime-guard.service.js';
import { removeFinishedCampaignRuntimeState } from './campaign-runtime-cleanup.service.js';
import { getCampaignQueueGate } from './campaign-queue-gate.service.js';
import { getCampaignPostSendDelay } from './campaign-post-send-delay.service.js';
import { processCampaignRecipient } from './campaign-recipient-processor.service.js';
import { readCampaign } from './campaign-reader.service.js';
import { isTerminalCampaignStatus } from './campaign-status-policy.service.js';
import { waitForCampaignRuntime } from './campaign-runtime-wait.service.js';
export async function runCampaignQueue(input) {
    const { campaignId, expectedRunId, runtimeStates } = input;
    const state = runtimeStates.get(campaignId);
    if (!canStartCampaignRuntime(state, expectedRunId))
        return;
    state.running = true;
    let sentSinceBatchPause = 0;
    try {
        while (!state.cancelled) {
            const currentState = runtimeStates.get(campaignId);
            if (!ownsCampaignRuntime(currentState, state, expectedRunId)) {
                console.warn(`[Campaign Queue] ${campaignId}: Runtime sahipliği değiştiği için eski worker sonlandırıldı.`);
                return;
            }
            if (state.paused) {
                const persistedCampaign = readCampaign(campaignId);
                if (persistedCampaign.status === 'running')
                    state.paused = false;
                else if (isTerminalCampaignStatus(persistedCampaign.status)) {
                    state.cancelled = persistedCampaign.status === 'cancelled';
                    return;
                }
                else {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    continue;
                }
            }
            const campaign = readCampaign(campaignId);
            if (campaign.status === 'paused') {
                state.paused = true;
                continue;
            }
            if (isTerminalCampaignStatus(campaign.status)) {
                state.cancelled = campaign.status === 'cancelled';
                return;
            }
            if (campaign.status !== 'running') {
                console.warn(`[Campaign Queue] ${campaignId}: Beklenmeyen kampanya durumu nedeniyle kuyruk durduruldu: ${campaign.status}`);
                return;
            }
            if (!campaign.accountId)
                throw new Error('Kampanya gönderen WhatsApp hesabı seçilmemiş.');
            const queueGate = getCampaignQueueGate(campaign);
            if (queueGate.type !== 'ready') {
                await waitForCampaignRuntime(state, queueGate.waitMs);
                continue;
            }
            const recipient = findNextPendingCampaignRecipient(campaignId);
            if (!recipient) {
                completeCampaign(campaignId);
                refreshCampaignRecipientCounts(campaignId);
                return;
            }
            const { recipientClaimed, sentSuccessfully } = await processCampaignRecipient({ campaign, recipient, state });
            refreshCampaignRecipientCounts(campaignId);
            if (!recipientClaimed)
                continue;
            if (state.cancelled || state.paused)
                continue;
            const postSendDelay = getCampaignPostSendDelay({ campaign, sentSuccessfully, sentSinceBatchPause });
            sentSinceBatchPause = postSendDelay.sentSinceBatchPause;
            await waitForCampaignRuntime(state, postSendDelay.waitMs);
        }
    }
    catch (reason) {
        const message = getCampaignErrorMessage(reason, 'Kampanya kuyruğu çalıştırılamadı.');
        failCampaignRecord(campaignId);
        console.error(`[Campaign] ${campaignId} queue failed: ${message}`);
    }
    finally {
        const ownsRuntime = ownsCampaignRuntime(runtimeStates.get(campaignId), state, expectedRunId);
        if (!ownsRuntime)
            return;
        state.running = false;
        state.wakeWait = undefined;
        try {
            reconcileCampaignState(campaignId);
        }
        catch (reason) {
            const message = getCampaignErrorMessage(reason, 'Kampanya durumu uzlaştırılamadı.');
            console.error(`[Campaign Queue] ${campaignId}: ${message}`);
        }
        if (state.cancelled)
            runtimeStates.delete(campaignId);
        else {
            try {
                removeFinishedCampaignRuntimeState({ campaignId, state, getStatus: getCampaignStatus, deleteState: (id) => runtimeStates.delete(id) });
            }
            catch (reason) {
                const message = getCampaignErrorMessage(reason, 'Runtime durumu temizlenemedi.');
                console.error(`[Campaign Queue] ${campaignId}: ${message}`);
            }
        }
    }
}
//# sourceMappingURL=campaign-queue-runner.service.js.map