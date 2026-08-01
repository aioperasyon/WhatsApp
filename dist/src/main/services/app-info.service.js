import { app } from 'electron';
export function getDesktopAppInfo() {
    return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        dataPath: app.getPath('userData'),
    };
}
//# sourceMappingURL=app-info.service.js.map