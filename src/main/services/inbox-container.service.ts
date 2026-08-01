import { getDatabase } from '../database/database.js';
import { InboxRepository } from '../repositories/inbox.repository.js';
import { InboxEventBusService } from './inbox-event-bus.service.js';
import { InboxRuntimeService } from './inbox-runtime.service.js';
import { InboxService } from './inbox.service.js';
import { WhatsAppMessageListenerService } from './whatsapp-message-listener.service.js';
import { WhatsAppMessageNormalizerService } from './whatsapp-message-normalizer.service.js';

let inboxServiceInstance: InboxService | null = null;
let inboxRuntimeInstance: InboxRuntimeService | null = null;

function createInboxServices(): {
  inboxService: InboxService;
  inboxRuntime: InboxRuntimeService;
} {
  const repository = new InboxRepository(getDatabase());
  const inboxService = new InboxService(repository);
  const eventBus = new InboxEventBusService();
  const normalizer = new WhatsAppMessageNormalizerService();
  const messageListener = new WhatsAppMessageListenerService(
    inboxService,
    normalizer,
    eventBus,
  );
  const inboxRuntime = new InboxRuntimeService(messageListener);

  return {
    inboxService,
    inboxRuntime,
  };
}

function ensureInboxServices(): void {
  if (inboxServiceInstance && inboxRuntimeInstance) {
    return;
  }

  const services = createInboxServices();
  inboxServiceInstance = services.inboxService;
  inboxRuntimeInstance = services.inboxRuntime;
}

export function getInboxService(): InboxService {
  ensureInboxServices();

  if (!inboxServiceInstance) {
    throw new Error('Gelen kutusu servisi başlatılamadı.');
  }

  return inboxServiceInstance;
}

export function getInboxRuntimeService(): InboxRuntimeService {
  ensureInboxServices();

  if (!inboxRuntimeInstance) {
    throw new Error('Gelen kutusu çalışma servisi başlatılamadı.');
  }

  return inboxRuntimeInstance;
}

export function shutdownInboxServices(): void {
  inboxRuntimeInstance?.detachAll();
  inboxRuntimeInstance = null;
  inboxServiceInstance = null;
}
