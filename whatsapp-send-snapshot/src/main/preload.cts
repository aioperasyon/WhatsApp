import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from '../../shared/interfaces/desktop-api.js';
import type { InboxEvent } from '../../shared/interfaces/inbox-events.js';

type ExtendedDesktopAPI = DesktopAPI & {
  deleteInboxChat(request: {
    accountId: string;
    chatId: string;
  }): Promise<{ deleted: boolean }>;
};

const desktopAPI: ExtendedDesktopAPI = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getDatabaseHealth: () =>
    ipcRenderer.invoke('database:get-health'),

  listWhatsAppAccounts: () =>
    ipcRenderer.invoke('whatsapp-accounts:list'),
  createWhatsAppAccount: (input) =>
    ipcRenderer.invoke('whatsapp-accounts:create', input),
  deleteWhatsAppAccount: (accountId) =>
    ipcRenderer.invoke('whatsapp-accounts:delete', accountId),
  connectWhatsAppAccount: (accountId) =>
    ipcRenderer.invoke('whatsapp-accounts:connect', accountId),
  getWhatsAppConnectionState: (accountId) =>
    ipcRenderer.invoke(
      'whatsapp-accounts:connection-state',
      accountId,
    ),
  disconnectWhatsAppAccount: (accountId) =>
    ipcRenderer.invoke('whatsapp-accounts:disconnect', accountId),

  listInboxChats: (request) =>
    ipcRenderer.invoke('inbox:list-chats', request),
  listInboxMessages: (request) =>
    ipcRenderer.invoke('inbox:list-messages', request),
  markInboxChatRead: (request) =>
    ipcRenderer.invoke('inbox:mark-chat-read', request),
  sendInboxMessage: (request) =>
    ipcRenderer.invoke('inbox:send-message', request),
  startInboxConversation: (request) =>
    ipcRenderer.invoke('inbox:start-conversation', request),
  deleteInboxChat: (request) =>
    ipcRenderer.invoke('inbox:delete-chat', request),

  onInboxEvent: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: InboxEvent,
    ): void => {
      listener(payload);
    };

    ipcRenderer.on('inbox:event', handler);

    return () => {
      ipcRenderer.removeListener('inbox:event', handler);
    };
  },
};

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
