"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const desktopAPI = {
    getAppInfo: () => electron_1.ipcRenderer.invoke('app:get-info'),
    getDatabaseHealth: () => electron_1.ipcRenderer.invoke('database:get-health'),
    listWhatsAppAccounts: () => electron_1.ipcRenderer.invoke('whatsapp-accounts:list'),
    createWhatsAppAccount: (input) => electron_1.ipcRenderer.invoke('whatsapp-accounts:create', input),
    deleteWhatsAppAccount: (accountId) => electron_1.ipcRenderer.invoke('whatsapp-accounts:delete', accountId),
    connectWhatsAppAccount: (accountId) => electron_1.ipcRenderer.invoke('whatsapp-accounts:connect', accountId),
    getWhatsAppConnectionState: (accountId) => electron_1.ipcRenderer.invoke('whatsapp-accounts:connection-state', accountId),
    disconnectWhatsAppAccount: (accountId) => electron_1.ipcRenderer.invoke('whatsapp-accounts:disconnect', accountId),
    listInboxChats: (request) => electron_1.ipcRenderer.invoke('inbox:list-chats', request),
    listInboxMessages: (request) => electron_1.ipcRenderer.invoke('inbox:list-messages', request),
    markInboxChatRead: (request) => electron_1.ipcRenderer.invoke('inbox:mark-chat-read', request),
    sendInboxMessage: (request) => electron_1.ipcRenderer.invoke('inbox:send-message', request),
    startInboxConversation: (request) => electron_1.ipcRenderer.invoke('inbox:start-conversation', request),
    deleteInboxChat: (request) => electron_1.ipcRenderer.invoke('inbox:delete-chat', request),
    listCrmContacts: (request) => electron_1.ipcRenderer.invoke('crm-contacts:list', request),
    saveCrmContact: (input) => electron_1.ipcRenderer.invoke('crm-contacts:save', input),
    deleteCrmContact: (request) => electron_1.ipcRenderer.invoke('crm-contacts:delete', request),
    previewCrmImport: () => electron_1.ipcRenderer.invoke('crm-contacts:preview-import'),
    applyCrmImport: (request) => electron_1.ipcRenderer.invoke('crm-contacts:apply-import', request),
    bulkUpdateCrmPermission: (request) => electron_1.ipcRenderer.invoke('crm-contacts:bulk-permission', request),
    bulkDeleteCrmContacts: (request) => electron_1.ipcRenderer.invoke('crm-contacts:bulk-delete', request),
    exportCrmContacts: (request) => electron_1.ipcRenderer.invoke('crm-contacts:export', request),
    listCampaigns: (request) => electron_1.ipcRenderer.invoke('campaigns:list', request),
    saveCampaign: (input) => electron_1.ipcRenderer.invoke('campaigns:save', input),
    deleteCampaign: (request) => electron_1.ipcRenderer.invoke('campaigns:delete', request),
    estimateCampaignAudience: (request) => electron_1.ipcRenderer.invoke('campaigns:estimate-audience', request),
    analyzeCampaignAudience: (request) => electron_1.ipcRenderer.invoke('campaigns:analyze-audience', request),
    getCampaignAudienceOptions: () => electron_1.ipcRenderer.invoke('campaigns:audience-options'),
    startCampaign: (request) => electron_1.ipcRenderer.invoke('campaigns:start', request),
    pauseCampaign: (request) => electron_1.ipcRenderer.invoke('campaigns:pause', request),
    resumeCampaign: (request) => electron_1.ipcRenderer.invoke('campaigns:resume', request),
    cancelCampaign: (request) => electron_1.ipcRenderer.invoke('campaigns:cancel', request),
    listCampaignRecipients: (request) => electron_1.ipcRenderer.invoke('campaigns:list-recipients', request),
    listMessageTemplates: (request) => electron_1.ipcRenderer.invoke('message-templates:list', request),
    saveMessageTemplate: (input) => electron_1.ipcRenderer.invoke('message-templates:save', input),
    deleteMessageTemplate: (request) => electron_1.ipcRenderer.invoke('message-templates:delete', request),
    markMessageTemplateUsed: (request) => electron_1.ipcRenderer.invoke('message-templates:mark-used', request),
    onInboxEvent: (listener) => {
        const handler = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on('inbox:event', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('inbox:event', handler);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
//# sourceMappingURL=preload.cjs.map