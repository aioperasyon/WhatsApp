import type {
  InboxChat,
  InboxChatListRequest,
  InboxChatReadRequest,
  InboxMessage,
  InboxMessageListRequest,
  InboxSendMessageRequest,
  InboxSendMessageResult,
  InboxStartConversationRequest,
  InboxStartConversationResult,
  InboxSnapshot,
} from '../../../shared/interfaces/inbox';
import type { InboxEvent } from '../../../shared/interfaces/inbox-events';
import type { InboxDesktopApi } from '../types/inbox-api';

function getInboxApi(): InboxDesktopApi {
  const api = (window as unknown as { desktopAPI?: Partial<InboxDesktopApi> })
    .desktopAPI;

  if (
    !api ||
    typeof api.listInboxChats !== 'function' ||
    typeof api.listInboxMessages !== 'function' ||
    typeof api.markInboxChatRead !== 'function' ||
    typeof api.sendInboxMessage !== 'function' ||
    typeof api.startInboxConversation !== 'function'
  ) {
    throw new Error(
      'Gelen kutusu masaüstü bağlantısı henüz hazırlanmadı. Uygulamayı yeniden başlatın.',
    );
  }

  return api as InboxDesktopApi;
}

export const inboxApiService = {
  listChats(request: InboxChatListRequest): Promise<InboxSnapshot> {
    return getInboxApi().listInboxChats(request);
  },

  listMessages(request: InboxMessageListRequest): Promise<InboxMessage[]> {
    return getInboxApi().listInboxMessages(request);
  },

  markChatRead(request: InboxChatReadRequest): Promise<InboxChat> {
    return getInboxApi().markInboxChatRead(request);
  },

  sendMessage(
    request: InboxSendMessageRequest,
  ): Promise<InboxSendMessageResult> {
    return getInboxApi().sendInboxMessage(request);
  },

  startConversation(
    request: InboxStartConversationRequest,
  ): Promise<InboxStartConversationResult> {
    return getInboxApi().startInboxConversation(request);
  },

  subscribe(listener: (event: InboxEvent) => void): () => void {
    const api = (window as unknown as { desktopAPI?: Partial<InboxDesktopApi> })
      .desktopAPI;

    if (!api || typeof api.onInboxEvent !== 'function') {
      return () => undefined;
    }

    return api.onInboxEvent(listener);
  },
};
