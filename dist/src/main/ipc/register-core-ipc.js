import { ipcMain } from 'electron';
import { createWhatsAppAccount, deleteWhatsAppAccount, listWhatsAppAccounts, } from '../repositories/whatsapp-account.repository.js';
import { getDesktopAppInfo } from '../services/app-info.service.js';
import { getDatabaseHealth } from '../services/database-health.service.js';
import { connectWhatsAppAccount, disconnectWhatsAppAccount, getWhatsAppConnectionState, } from '../services/whatsapp-connection.service.js';
const channels = {
    appInfo: 'app:get-info',
    databaseHealth: 'database:get-health',
    accountList: 'whatsapp-accounts:list',
    accountCreate: 'whatsapp-accounts:create',
    accountDelete: 'whatsapp-accounts:delete',
    accountConnect: 'whatsapp-accounts:connect',
    accountConnectionState: 'whatsapp-accounts:connection-state',
    accountDisconnect: 'whatsapp-accounts:disconnect',
};
export function registerCoreIpcHandlers() {
    Object.values(channels).forEach((channel) => {
        ipcMain.removeHandler(channel);
    });
    ipcMain.handle(channels.appInfo, () => getDesktopAppInfo());
    ipcMain.handle(channels.databaseHealth, () => getDatabaseHealth());
    ipcMain.handle(channels.accountList, () => listWhatsAppAccounts());
    ipcMain.handle(channels.accountCreate, (_event, input) => createWhatsAppAccount(input));
    ipcMain.handle(channels.accountDelete, (_event, accountId) => deleteWhatsAppAccount(accountId));
    ipcMain.handle(channels.accountConnect, (_event, accountId) => connectWhatsAppAccount(accountId));
    ipcMain.handle(channels.accountConnectionState, (_event, accountId) => getWhatsAppConnectionState(accountId));
    ipcMain.handle(channels.accountDisconnect, (_event, accountId) => disconnectWhatsAppAccount(accountId));
}
//# sourceMappingURL=register-core-ipc.js.map