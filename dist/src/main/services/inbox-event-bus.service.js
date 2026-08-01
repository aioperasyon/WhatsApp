import { BrowserWindow } from 'electron';
import { INBOX_EVENT_CHANNELS } from '../ipc/inbox-event-channels.js';
export class InboxEventBusService {
    publish(event) {
        for (const window of BrowserWindow.getAllWindows()) {
            if (window.isDestroyed())
                continue;
            window.webContents.send(INBOX_EVENT_CHANNELS.changed, event);
        }
    }
}
//# sourceMappingURL=inbox-event-bus.service.js.map