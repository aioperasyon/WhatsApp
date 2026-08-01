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

export interface InboxDesktopApi {
  listInboxChats(request: InboxChatListRequest): Promise<InboxSnapshot>;
  listInboxMessages(request: InboxMessageListRequest): Promise<InboxMessage[]>;
  markInboxChatRead(request: InboxChatReadRequest): Promise<InboxChat>;
  sendInboxMessage(
    request: InboxSendMessageRequest,
  ): Promise<InboxSendMessageResult>;
  startInboxConversation(
    request: InboxStartConversationRequest,
  ): Promise<InboxStartConversationResult>;
  onInboxEvent(listener: (event: InboxEvent) => void): () => void;
}
