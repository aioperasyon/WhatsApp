import type { DesktopAPI } from '../../../shared/interfaces/desktop-api';

declare global {
  interface Window {
    desktopAPI: DesktopAPI;
  }
}

export {};
