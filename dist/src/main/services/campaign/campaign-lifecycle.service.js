import { cancelCampaignRecord, pauseCampaignRecord, resumeCampaignRecord } from '../../repositories/campaign-control.repository.js';
import { claimCampaignStart } from '../../repositories/campaign-state.repository.js';
import { refreshCampaignRecipientCounts, seedCampaignRecipients } from '../../repositories/campaign-recipient-queue.repository.js';
import { countPendingCampaignRecipients } from '../../repositories/campaign-recipient-lifecycle.repository.js';
import { readCampaign } from './campaign-reader.service.js';
import { getStartableCampaignStatuses, isStartableCampaignStatus } from './campaign-status-policy.service.js';
import { createCampaignRuntimeState, prepareCampaignRuntimeState } from './campaign-runtime-state.service.js';
import { wakeCampaignRuntime } from './campaign-runtime-wait.service.js';
export function startCampaignLifecycle(campaignId, d) {
    if (d.isShuttingDown())
        throw new Error('Uygulama kapanırken yeni kampanya başlatılamaz.');
    const campaign = readCampaign(campaignId);
    if (!campaign.accountId)
        throw new Error('Kampanyayı başlatmak için bir WhatsApp hesabı seçin.');
    const activeRuntime = d.runtimeStates.get(campaignId);
    if (activeRuntime?.running && !activeRuntime.cancelled)
        throw new Error('Bu kampanya kuyruğu zaten çalışıyor.');
    const startableStatuses = getStartableCampaignStatuses();
    if (!isStartableCampaignStatus(campaign.status))
        throw new Error('Bu kampanya mevcut durumunda başlatılamaz.');
    seedCampaignRecipients(campaign);
    if (countPendingCampaignRecipients(campaignId) === 0)
        throw new Error('Kampanyada gönderilecek bekleyen alıcı yok.');
    if (!claimCampaignStart(campaignId, startableStatuses)) {
        const latest = readCampaign(campaignId);
        if (latest.status === 'running')
            throw new Error('Kampanya başka bir işlem tarafından zaten başlatıldı.');
        throw new Error(`Kampanya başlatma kilidi alınamadı. Güncel durum: ${latest.status}`);
    }
    const state = prepareCampaignRuntimeState(d.runtimeStates.get(campaignId));
    d.runtimeStates.set(campaignId, state);
    void d.runQueue(campaignId, state.runId);
    return { campaign: readCampaign(campaignId), message: 'Kampanya gönderim kuyruğu başlatıldı.' };
}
export function pauseCampaignLifecycle(campaignId, d) {
    const campaign = readCampaign(campaignId);
    if (campaign.status !== 'running')
        throw new Error('Yalnızca çalışan kampanya durdurulabilir.');
    const state = d.runtimeStates.get(campaignId) ?? createCampaignRuntimeState();
    state.paused = true;
    d.runtimeStates.set(campaignId, state);
    wakeCampaignRuntime(state);
    if (!pauseCampaignRecord(campaignId))
        throw new Error('Kampanya duraklatma kilidi alınamadı. Durum başka bir işlem tarafından değiştirilmiş olabilir.');
    return { campaign: readCampaign(campaignId), message: 'Kampanya duraklatıldı.' };
}
export function resumeCampaignLifecycle(campaignId, d) {
    const campaign = readCampaign(campaignId);
    if (campaign.status !== 'paused')
        throw new Error('Yalnızca duraklatılmış kampanya devam ettirilebilir.');
    const state = prepareCampaignRuntimeState(d.runtimeStates.get(campaignId));
    wakeCampaignRuntime(state);
    d.runtimeStates.set(campaignId, state);
    if (!resumeCampaignRecord(campaignId))
        throw new Error('Kampanya devam ettirme kilidi alınamadı. Durum başka bir işlem tarafından değiştirilmiş olabilir.');
    void d.runQueue(campaignId, state.runId);
    return { campaign: readCampaign(campaignId), message: 'Kampanya devam ettirildi.' };
}
export function cancelCampaignLifecycle(campaignId, d) {
    const campaign = readCampaign(campaignId);
    if (!['running', 'paused'].includes(campaign.status))
        throw new Error('Yalnızca çalışan veya duraklatılmış kampanya iptal edilebilir.');
    const state = d.runtimeStates.get(campaignId) ?? createCampaignRuntimeState();
    state.cancelled = true;
    state.paused = false;
    d.runtimeStates.set(campaignId, state);
    wakeCampaignRuntime(state);
    cancelCampaignRecord(campaignId);
    refreshCampaignRecipientCounts(campaignId);
    return { campaign: readCampaign(campaignId), message: 'Kampanya iptal edildi.' };
}
//# sourceMappingURL=campaign-lifecycle.service.js.map