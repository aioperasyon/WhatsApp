import { app } from 'electron';
import type { DesktopAppInfo } from '../../../shared/interfaces/desktop-api.js';

export function getDesktopAppInfo(): DesktopAppInfo {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    dataPath: app.getPath('userData'),
  };
}
