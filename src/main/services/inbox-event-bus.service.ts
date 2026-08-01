import { BrowserWindow } from 'electron';
import type { InboxEvent } from '../../../shared/interfaces/inbox-events.js';
import { INBOX_EVENT_CHANNELS } from '../ipc/inbox-event-channels.js';

export class InboxEventBusService {
  publish(event: InboxEvent): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      window.webContents.send(INBOX_EVENT_CHANNELS.changed, event);
    }
  }
}
