import { ipcMain } from 'electron';
import type {
  CreateWhatsAppAccountInput,
} from '../../../shared/interfaces/whatsapp-account.js';
import {
  createWhatsAppAccount,
  deleteWhatsAppAccount,
  listWhatsAppAccounts,
} from '../repositories/whatsapp-account.repository.js';
import { getDesktopAppInfo } from '../services/app-info.service.js';
import { getDatabaseHealth } from '../services/database-health.service.js';
import {
  connectWhatsAppAccount,
  disconnectWhatsAppAccount,
  getWhatsAppConnectionState,
} from '../services/whatsapp-connection.service.js';

const channels = {
  appInfo: 'app:get-info',
  databaseHealth: 'database:get-health',
  accountList: 'whatsapp-accounts:list',
  accountCreate: 'whatsapp-accounts:create',
  accountDelete: 'whatsapp-accounts:delete',
  accountConnect: 'whatsapp-accounts:connect',
  accountConnectionState: 'whatsapp-accounts:connection-state',
  accountDisconnect: 'whatsapp-accounts:disconnect',
} as const;

export function registerCoreIpcHandlers(): void {
  Object.values(channels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });

  ipcMain.handle(channels.appInfo, () => getDesktopAppInfo());
  ipcMain.handle(
    channels.databaseHealth,
    () => getDatabaseHealth(),
  );
  ipcMain.handle(
    channels.accountList,
    () => listWhatsAppAccounts(),
  );
  ipcMain.handle(
    channels.accountCreate,
    (
      _event,
      input: CreateWhatsAppAccountInput,
    ) => createWhatsAppAccount(input),
  );
  ipcMain.handle(
    channels.accountDelete,
    (_event, accountId: string) =>
      deleteWhatsAppAccount(accountId),
  );
  ipcMain.handle(
    channels.accountConnect,
    (_event, accountId: string) =>
      connectWhatsAppAccount(accountId),
  );
  ipcMain.handle(
    channels.accountConnectionState,
    (_event, accountId: string) =>
      getWhatsAppConnectionState(accountId),
  );
  ipcMain.handle(
    channels.accountDisconnect,
    (_event, accountId: string) =>
      disconnectWhatsAppAccount(accountId),
  );
}
