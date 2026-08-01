import type { InboxChat, InboxMessage } from './inbox.js';

export type InboxEventType =
  | 'chat-updated'
  | 'message-created'
  | 'message-status-updated';

export interface InboxChatUpdatedEvent {
  type: 'chat-updated';
  accountId: string;
  chat: InboxChat;
}

export interface InboxMessageCreatedEvent {
  type: 'message-created';
  accountId: string;
  message: InboxMessage;
}

export interface InboxMessageStatusUpdatedEvent {
  type: 'message-status-updated';
  accountId: string;
  whatsappMessageId: string;
  status: InboxMessage['status'];
}

export type InboxEvent =
  | InboxChatUpdatedEvent
  | InboxMessageCreatedEvent
  | InboxMessageStatusUpdatedEvent;
