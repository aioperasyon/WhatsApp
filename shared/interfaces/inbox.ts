export type InboxMessageDirection = 'incoming' | 'outgoing';
export type InboxMessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface InboxChat {
  id: string;
  accountId: string;
  jid: string;
  displayName: string | null;
  phoneNumber: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxMessage {
  id: string;
  accountId: string;
  chatId: string;
  remoteJid: string;
  whatsappMessageId: string | null;
  direction: InboxMessageDirection;
  senderJid: string | null;
  text: string | null;
  messageType: string;
  status: InboxMessageStatus;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxChatListRequest {
  accountId: string;
  search?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface InboxMessageListRequest {
  accountId: string;
  chatId: string;
  limit?: number;
  before?: string;
}

export interface InboxChatReadRequest {
  accountId: string;
  chatId: string;
}

export interface InboxSendMessageRequest {
  accountId: string;
  chatId: string;
  remoteJid: string;
  text: string;
}

export interface InboxSendMessageResult {
  whatsappMessageId: string | null;
  sentAt: string;
}

export interface InboxStartConversationRequest {
  accountId: string;
  phoneNumber: string;
  text: string;
}

export interface InboxStartConversationResult {
  remoteJid: string;
  whatsappMessageId: string | null;
  sentAt: string;
}

export interface InboxSnapshot {
  chats: InboxChat[];
  total: number;
}
