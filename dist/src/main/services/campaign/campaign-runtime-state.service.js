import { randomUUID } from 'node:crypto';
export function createCampaignRuntimeState() {
    return {
        cancelled: false,
        paused: false,
        running: false,
        runId: randomUUID(),
    };
}
export function prepareCampaignRuntimeState(existingState) {
    const state = existingState && !existingState.running
        ? existingState
        : createCampaignRuntimeState();
    state.cancelled = false;
    state.paused = false;
    state.runId = randomUUID();
    return state;
}
//# sourceMappingURL=campaign-runtime-state.service.js.map