import { ipcMain } from 'electron';
import type {
  InboxChatListRequest,
  InboxChatReadRequest,
  InboxMessageListRequest,
  InboxSendMessageRequest,
  InboxStartConversationRequest,
} from '../../../shared/interfaces/inbox.js';
import type { InboxService } from '../services/inbox.service.js';
import {
  deleteWhatsAppChat,
  sendInboxMessage,
  startInboxConversation,
} from '../services/whatsapp-connection.service.js';

const IPC_CHANNELS = {
  listChats: 'inbox:list-chats',
  listMessages: 'inbox:list-messages',
  markChatRead: 'inbox:mark-chat-read',
  sendMessage: 'inbox:send-message',
  startConversation: 'inbox:start-conversation',
  deleteChat: 'inbox:delete-chat',
} as const;

export function registerInboxIpc(inboxService: InboxService): void {
  ipcMain.removeHandler(IPC_CHANNELS.listChats);
  ipcMain.removeHandler(IPC_CHANNELS.listMessages);
  ipcMain.removeHandler(IPC_CHANNELS.markChatRead);
  ipcMain.removeHandler(IPC_CHANNELS.sendMessage);
  ipcMain.removeHandler(IPC_CHANNELS.startConversation);
  ipcMain.removeHandler(IPC_CHANNELS.deleteChat);

  ipcMain.handle(
    IPC_CHANNELS.listChats,
    (_event, request: InboxChatListRequest) =>
      inboxService.listChats(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.listMessages,
    (_event, request: InboxMessageListRequest) =>
      inboxService.listMessages(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.markChatRead,
    (_event, request: InboxChatReadRequest) =>
      inboxService.markChatRead(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.sendMessage,
    (_event, request: InboxSendMessageRequest) =>
      sendInboxMessage(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.startConversation,
    (_event, request: InboxStartConversationRequest) =>
      startInboxConversation(request),
  );

  ipcMain.handle(
    IPC_CHANNELS.deleteChat,
    async (
      _event,
      request: {
        accountId: string;
        chatId: string;
      },
    ) => {
      const context =
        inboxService.getChatDeleteContext(request);

      await deleteWhatsAppChat(context);

      return inboxService.deleteChat(request);
    },
  );
}
