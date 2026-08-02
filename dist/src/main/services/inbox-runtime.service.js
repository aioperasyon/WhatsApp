export class InboxRuntimeService {
    messageListener;
    activeListeners = new Map();
    constructor(messageListener) {
        this.messageListener = messageListener;
    }
    attachAccount(accountId, socket) {
        this.detachAccount(accountId);
        const detach = this.messageListener.attach(accountId, socket);
        this.activeListeners.set(accountId, { socket, detach });
    }
    detachAccount(accountId) {
        const active = this.activeListeners.get(accountId);
        if (!active)
            return;
        active.detach();
        this.activeListeners.delete(accountId);
    }
    detachAll() {
        for (const accountId of [...this.activeListeners.keys()]) {
            this.detachAccount(accountId);
        }
    }
    isAttached(accountId) {
        return this.activeListeners.has(accountId);
    }
}
//# sourceMappingURL=inbox-runtime.service.js.map