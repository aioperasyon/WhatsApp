import { ipcMain } from 'electron';
import { deleteWhatsAppChat, sendInboxMessage, startInboxConversation, } from '../services/whatsapp-connection.service.js';
const IPC_CHANNELS = {
    listChats: 'inbox:list-chats',
    listMessages: 'inbox:list-messages',
    markChatRead: 'inbox:mark-chat-read',
    sendMessage: 'inbox:send-message',
    startConversation: 'inbox:start-conversation',
    deleteChat: 'inbox:delete-chat',
};
export function registerInboxIpc(inboxService) {
    ipcMain.removeHandler(IPC_CHANNELS.listChats);
    ipcMain.removeHandler(IPC_CHANNELS.listMessages);
    ipcMain.removeHandler(IPC_CHANNELS.markChatRead);
    ipcMain.removeHandler(IPC_CHANNELS.sendMessage);
    ipcMain.removeHandler(IPC_CHANNELS.startConversation);
    ipcMain.removeHandler(IPC_CHANNELS.deleteChat);
    ipcMain.handle(IPC_CHANNELS.listChats, (_event, request) => inboxService.listChats(request));
    ipcMain.handle(IPC_CHANNELS.listMessages, (_event, request) => inboxService.listMessages(request));
    ipcMain.handle(IPC_CHANNELS.markChatRead, (_event, request) => inboxService.markChatRead(request));
    ipcMain.handle(IPC_CHANNELS.sendMessage, (_event, request) => sendInboxMessage(request));
    ipcMain.handle(IPC_CHANNELS.startConversation, (_event, request) => startInboxConversation(request));
    ipcMain.handle(IPC_CHANNELS.deleteChat, async (_event, request) => {
        const context = inboxService.getChatDeleteContext(request);
        await deleteWhatsAppChat(context);
        return inboxService.deleteChat(request);
    });
}
//# sourceMappingURL=register-inbox-ipc.js.map