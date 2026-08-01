import type {
  WhatsAppMessageListenerService,
  WhatsAppSocketLike,
} from './whatsapp-message-listener.service.js';

interface ActiveListener {
  socket: WhatsAppSocketLike;
  detach: () => void;
}

export class InboxRuntimeService {
  private readonly activeListeners = new Map<string, ActiveListener>();

  constructor(
    private readonly messageListener: WhatsAppMessageListenerService,
  ) {}

  attachAccount(accountId: string, socket: WhatsAppSocketLike): void {
    this.detachAccount(accountId);

    const detach = this.messageListener.attach(accountId, socket);
    this.activeListeners.set(accountId, { socket, detach });
  }

  detachAccount(accountId: string): void {
    const active = this.activeListeners.get(accountId);
    if (!active) return;

    active.detach();
    this.activeListeners.delete(accountId);
  }

  detachAll(): void {
    for (const accountId of [...this.activeListeners.keys()]) {
      this.detachAccount(accountId);
    }
  }

  isAttached(accountId: string): boolean {
    return this.activeListeners.has(accountId);
  }
}
