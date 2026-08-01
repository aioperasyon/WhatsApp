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
} from './inbox.js';
import type { InboxEvent } from './inbox-events.js';
import type {
  CreateWhatsAppAccountInput,
  DeleteWhatsAppAccountResult,
  WhatsAppAccount,
} from './whatsapp-account.js';

export interface DesktopAppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
  dataPath: string;
}

export interface DatabaseHealth {
  connected: boolean;
  schemaVersion: number;
  databasePath: string;
  tables: string[];
  error?: string;
}

export interface WhatsAppConnectionState {
  account: WhatsAppAccount;
  qrDataUrl: string | null;
  message: string | null;
}

export interface DesktopAPI {
  getAppInfo(): Promise<DesktopAppInfo>;
  getDatabaseHealth(): Promise<DatabaseHealth>;

  listWhatsAppAccounts(): Promise<WhatsAppAccount[]>;
  createWhatsAppAccount(
    input: CreateWhatsAppAccountInput,
  ): Promise<WhatsAppAccount>;
  deleteWhatsAppAccount(
    accountId: string,
  ): Promise<DeleteWhatsAppAccountResult>;
  connectWhatsAppAccount(
    accountId: string,
  ): Promise<WhatsAppConnectionState>;
  getWhatsAppConnectionState(
    accountId: string,
  ): Promise<WhatsAppConnectionState>;
  disconnectWhatsAppAccount(
    accountId: string,
  ): Promise<WhatsAppConnectionState>;

  listInboxChats(
    request: InboxChatListRequest,
  ): Promise<InboxSnapshot>;
  listInboxMessages(
    request: InboxMessageListRequest,
  ): Promise<InboxMessage[]>;
  markInboxChatRead(
    request: InboxChatReadRequest,
  ): Promise<InboxChat>;
  sendInboxMessage(
    request: InboxSendMessageRequest,
  ): Promise<InboxSendMessageResult>;
  startInboxConversation(
    request: InboxStartConversationRequest,
  ): Promise<InboxStartConversationResult>;
  onInboxEvent(
    listener: (event: InboxEvent) => void,
  ): () => void;
}
