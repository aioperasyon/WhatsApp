export function canStartCampaignRuntime(state, expectedRunId) {
    return Boolean(state &&
        !state.running &&
        state.runId === expectedRunId);
}
export function ownsCampaignRuntime(currentState, expectedState, expectedRunId) {
    return (currentState === expectedState &&
        expectedState.runId === expectedRunId);
}
//# sourceMappingURL=campaign-runtime-guard.service.js.map