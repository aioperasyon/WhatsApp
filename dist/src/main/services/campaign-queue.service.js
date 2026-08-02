import { processScheduledCampaigns as processScheduledCampaignsService, restartCampaignScheduler as restartCampaignSchedulerService, startCampaignScheduler as startCampaignSchedulerService, stopCampaignScheduler as stopCampaignSchedulerService, } from './campaign/campaign-scheduler.service.js';
import { recoverInterruptedCampaigns as recoverInterruptedCampaignsService, } from './campaign/campaign-recovery.service.js';
import { runCampaignQueue, } from './campaign/campaign-queue-runner.service.js';
import { clearFinishedCampaignRuntimes, } from './campaign/campaign-runtime-sweeper.service.js';
import { shutdownCampaignRuntimeEngine, } from './campaign/campaign-engine-shutdown.service.js';
import { cancelCampaignLifecycle, pauseCampaignLifecycle, resumeCampaignLifecycle, startCampaignLifecycle, } from './campaign/campaign-lifecycle.service.js';
import { createCampaignSchedulerDependencies, } from './campaign/campaign-scheduler-dependencies.service.js';
import { createCampaignLifecycleDependencies, } from './campaign/campaign-lifecycle-dependencies.service.js';
export { listCampaignRecipients } from '../repositories/campaign-recipient.repository.js';
const runtimeStates = new Map();
let campaignEngineShuttingDown = false;
async function runQueue(campaignId, expectedRunId) {
    await runCampaignQueue({
        campaignId,
        expectedRunId,
        runtimeStates,
    });
}
function getCampaignLifecycleDependencies() {
    return createCampaignLifecycleDependencies({
        runtimeStates,
        isShuttingDown: () => campaignEngineShuttingDown,
        runQueue,
    });
}
export function startCampaign(campaignId) {
    return startCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}
export function pauseCampaign(campaignId) {
    return pauseCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}
export function resumeCampaign(campaignId) {
    return resumeCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}
export function cancelCampaign(campaignId) {
    return cancelCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}
function getCampaignSchedulerDependencies() {
    return createCampaignSchedulerDependencies({
        isShuttingDown: () => campaignEngineShuttingDown,
        startCampaign,
        clearFinishedRuntimeStates: clearFinishedCampaignRuntimeStates,
    });
}
export async function processScheduledCampaigns() {
    await processScheduledCampaignsService(getCampaignSchedulerDependencies());
}
export function startCampaignScheduler() {
    startCampaignSchedulerService(getCampaignSchedulerDependencies());
}
export function stopCampaignScheduler() {
    stopCampaignSchedulerService(clearFinishedCampaignRuntimeStates);
}
export function restartCampaignScheduler() {
    restartCampaignSchedulerService(getCampaignSchedulerDependencies());
}
export function clearFinishedCampaignRuntimeStates() {
    clearFinishedCampaignRuntimes(runtimeStates);
}
export async function shutdownCampaignEngine(timeoutMs = 15000) {
    if (campaignEngineShuttingDown) {
        return;
    }
    campaignEngineShuttingDown = true;
    await shutdownCampaignRuntimeEngine({
        runtimeStates,
        timeoutMs,
        stopScheduler: stopCampaignScheduler,
    });
}
export function recoverInterruptedCampaigns() {
    recoverInterruptedCampaignsService();
}
//# sourceMappingURL=campaign-queue.service.js.map