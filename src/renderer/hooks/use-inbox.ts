import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InboxChat,
  InboxMessage,
} from '../../../shared/interfaces/inbox';
import type { InboxEvent } from '../../../shared/interfaces/inbox-events';
import { inboxApiService } from '../services/inbox-api.service';
import {
  reportTechnicalError,
  toUserErrorMessage,
} from '../services/error-message.service';

const CHAT_PAGE_SIZE = 50;
const MESSAGE_PAGE_SIZE = 100;

interface UseInboxOptions {
  search: string;
  unreadOnly: boolean;
}

interface UseInboxResult {
  chats: InboxChat[];
  totalChats: number;
  messages: InboxMessage[];
  selectedChat: InboxChat | null;
  loadingChats: boolean;
  loadingMoreChats: boolean;
  hasMoreChats: boolean;
  loadingMessages: boolean;
  loadingOlderMessages: boolean;
  hasOlderMessages: boolean;
  sendingMessage: boolean;
  startingConversation: boolean;
  error: string | null;
  selectChat(chat: InboxChat): Promise<void>;
  refreshChats(): Promise<void>;
  loadMoreChats(): Promise<void>;
  loadOlderMessages(): Promise<number>;
  sendMessage(text: string): Promise<boolean>;
  startConversation(
    phoneNumber: string,
    text: string,
  ): Promise<InboxChat | null>;
}

function mergeMessages(
  current: InboxMessage[],
  incoming: InboxMessage[],
): InboxMessage[] {
  const byId = new Map<string, InboxMessage>();

  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(left.timestamp).getTime() -
      new Date(right.timestamp).getTime(),
  );
}

function mergeChats(
  current: InboxChat[],
  incoming: InboxChat[],
): InboxChat[] {
  const byId = new Map<string, InboxChat>();

  for (const chat of [...current, ...incoming]) {
    byId.set(chat.id, chat);
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftTime = left.lastMessageAt
      ? new Date(left.lastMessageAt).getTime()
      : 0;
    const rightTime = right.lastMessageAt
      ? new Date(right.lastMessageAt).getTime()
      : 0;

    return rightTime - leftTime;
  });
}

function chatMatches(
  chat: InboxChat,
  search: string,
  unreadOnly: boolean,
): boolean {
  if (unreadOnly && chat.unreadCount <= 0) return false;

  const normalized = search.trim().toLocaleLowerCase('tr-TR');
  if (!normalized) return true;

  return [
    chat.displayName,
    chat.phoneNumber,
    chat.jid,
    chat.lastMessagePreview,
  ].some((value) =>
    value?.toLocaleLowerCase('tr-TR').includes(normalized),
  );
}

export function useInbox(
  accountId: string | null,
  options: UseInboxOptions,
): UseInboxResult {
  const { search, unreadOnly } = options;
  const [chats, setChats] = useState<InboxChat[]>([]);
  const [totalChats, setTotalChats] = useState(0);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const chatRequestSequenceRef = useRef(0);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const refreshChats = useCallback(async (): Promise<void> => {
    const sequence = ++chatRequestSequenceRef.current;

    if (!accountId) {
      setChats([]);
      setTotalChats(0);
      setSelectedChatId(null);
      setMessages([]);
      return;
    }

    setLoadingChats(true);
    setError(null);

    try {
      const snapshot = await inboxApiService.listChats({
        accountId,
        search,
        unreadOnly,
        limit: CHAT_PAGE_SIZE,
        offset: 0,
      });

      if (sequence !== chatRequestSequenceRef.current) return;

      setChats(snapshot.chats);
      setTotalChats(snapshot.total);
      setSelectedChatId((current) => {
        if (current && snapshot.chats.some((chat) => chat.id === current)) {
          return current;
        }

        return snapshot.chats[0]?.id ?? null;
      });
    } catch (reason: unknown) {
      if (sequence !== chatRequestSequenceRef.current) return;

      reportTechnicalError('Inbox/Chats', reason);
      setError(
        toUserErrorMessage(
          reason,
          'Sohbetler yüklenemedi. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      if (sequence === chatRequestSequenceRef.current) {
        setLoadingChats(false);
      }
    }
  }, [accountId, search, unreadOnly]);

  const loadMoreChats = useCallback(async (): Promise<void> => {
    if (
      !accountId ||
      loadingChats ||
      loadingMoreChats ||
      chats.length >= totalChats
    ) {
      return;
    }

    setLoadingMoreChats(true);
    setError(null);

    try {
      const snapshot = await inboxApiService.listChats({
        accountId,
        search,
        unreadOnly,
        limit: CHAT_PAGE_SIZE,
        offset: chats.length,
      });

      setChats((current) => mergeChats(current, snapshot.chats));
      setTotalChats(snapshot.total);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Diğer sohbetler yüklenirken bilinmeyen bir hata oluştu.',
      );
    } finally {
      setLoadingMoreChats(false);
    }
  }, [
    accountId,
    chats.length,
    loadingChats,
    loadingMoreChats,
    search,
    totalChats,
    unreadOnly,
  ]);

  const loadInitialMessages = useCallback(
    async (chat: InboxChat): Promise<void> => {
      if (!accountId) return;

      const sequence = ++loadSequenceRef.current;
      setLoadingMessages(true);
      setLoadingOlderMessages(false);
      setHasOlderMessages(false);
      setMessages([]);
      setError(null);

      try {
        const result = await inboxApiService.listMessages({
          accountId,
          chatId: chat.id,
          limit: MESSAGE_PAGE_SIZE,
        });

        if (sequence !== loadSequenceRef.current) return;

        setMessages(result);
        setHasOlderMessages(result.length === MESSAGE_PAGE_SIZE);

        if (chat.unreadCount > 0) {
          const updated = await inboxApiService.markChatRead({
            accountId,
            chatId: chat.id,
          });

          setChats((current) => {
            if (unreadOnly) {
              return current.filter((item) => item.id !== updated.id);
            }

            return current.map((item) =>
              item.id === updated.id ? updated : item,
            );
          });

          if (unreadOnly) {
            setTotalChats((current) => Math.max(0, current - 1));
          }
        }
      } catch (reason: unknown) {
        if (sequence !== loadSequenceRef.current) return;

        reportTechnicalError('Inbox/Messages', reason);
        setError(
          toUserErrorMessage(
            reason,
            'Mesajlar yüklenemedi. Lütfen tekrar deneyin.',
          ),
        );
      } finally {
        if (sequence === loadSequenceRef.current) {
          setLoadingMessages(false);
        }
      }
    },
    [accountId, unreadOnly],
  );

  const selectChat = useCallback(
    async (chat: InboxChat): Promise<void> => {
      if (chat.id === selectedChatId) return;
      setSelectedChatId(chat.id);
    },
    [selectedChatId],
  );

  const loadOlderMessages = useCallback(async (): Promise<number> => {
    if (
      !accountId ||
      !selectedChat ||
      loadingMessages ||
      loadingOlderMessages ||
      !hasOlderMessages ||
      messages.length === 0
    ) {
      return 0;
    }

    const oldestMessage = messages[0];
    setLoadingOlderMessages(true);
    setError(null);

    try {
      const older = await inboxApiService.listMessages({
        accountId,
        chatId: selectedChat.id,
        limit: MESSAGE_PAGE_SIZE,
        before: oldestMessage.timestamp,
      });

      setMessages((current) => mergeMessages(older, current));
      setHasOlderMessages(older.length === MESSAGE_PAGE_SIZE);

      return older.length;
    } catch (reason: unknown) {
      reportTechnicalError('Inbox/OlderMessages', reason);
      setError(
        toUserErrorMessage(
          reason,
          'Eski mesajlar yüklenemedi. Lütfen tekrar deneyin.',
        ),
      );
      return 0;
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [
    accountId,
    hasOlderMessages,
    loadingMessages,
    loadingOlderMessages,
    messages,
    selectedChat,
  ]);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const normalizedText = text.trim();

      if (!accountId || !selectedChat || !normalizedText || sendingMessage) {
        return false;
      }

      setSendingMessage(true);
      setError(null);

      try {
        await inboxApiService.sendMessage({
          accountId,
          chatId: selectedChat.id,
          remoteJid: selectedChat.jid,
          text: normalizedText,
        });

        const latest = await inboxApiService.listMessages({
          accountId,
          chatId: selectedChat.id,
          limit: MESSAGE_PAGE_SIZE,
        });

        setMessages((current) => mergeMessages(current, latest));
        return true;
      } catch (reason: unknown) {
        reportTechnicalError('Inbox/SendMessage', reason);
        setError(
          toUserErrorMessage(
            reason,
            'Mesaj gönderilemedi. Lütfen tekrar deneyin.',
          ),
        );
        return false;
      } finally {
        setSendingMessage(false);
      }
    },
    [accountId, selectedChat, sendingMessage],
  );


  const startConversation = useCallback(
    async (
      phoneNumber: string,
      text: string,
    ): Promise<InboxChat | null> => {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const normalizedText = text.trim();

      if (
        !accountId ||
        !normalizedPhone ||
        !normalizedText ||
        startingConversation
      ) {
        return null;
      }

      setStartingConversation(true);
      setError(null);

      try {
        const result = await inboxApiService.startConversation({
          accountId,
          phoneNumber: normalizedPhone,
          text: normalizedText,
        });

        let foundChat: InboxChat | null = null;

        for (let attempt = 0; attempt < 8; attempt += 1) {
          const snapshot = await inboxApiService.listChats({
            accountId,
            search: normalizedPhone,
            unreadOnly: false,
            limit: 20,
            offset: 0,
          });

          foundChat =
            snapshot.chats.find(
              (chat) =>
                chat.jid === result.remoteJid ||
                chat.phoneNumber === normalizedPhone,
            ) ?? null;

          if (foundChat) {
            break;
          }

          await new Promise((resolve) => {
            window.setTimeout(resolve, 250);
          });
        }

        await refreshChats();

        if (foundChat) {
          setSelectedChatId(foundChat.id);
        }

        return foundChat;
      } catch (reason: unknown) {
        reportTechnicalError('Inbox/StartConversation', reason);
        setError(
          toUserErrorMessage(
            reason,
            'Yeni sohbet başlatılamadı. Lütfen tekrar deneyin.',
          ),
        );

        return null;
      } finally {
        setStartingConversation(false);
      }
    },
    [
      accountId,
      refreshChats,
      startingConversation,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshChats();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [refreshChats]);

  useEffect(() => {
    if (!selectedChat || !accountId) {
      loadSequenceRef.current += 1;
      setMessages([]);
      setHasOlderMessages(false);
      return;
    }

    void loadInitialMessages(selectedChat);
  }, [accountId, loadInitialMessages, selectedChat?.id]);

  useEffect(() => {
    if (!accountId) return undefined;

    const unsubscribe = inboxApiService.subscribe((event: InboxEvent) => {
      if (event.accountId !== accountId) return;

      if (event.type === 'chat-updated') {
        setChats((current) => {
          const existed = current.some((chat) => chat.id === event.chat.id);
          const withoutUpdated = current.filter(
            (chat) => chat.id !== event.chat.id,
          );

          if (!chatMatches(event.chat, search, unreadOnly)) {
            if (existed) {
              setTotalChats((total) => Math.max(0, total - 1));
            }
            return withoutUpdated;
          }

          if (!existed) {
            setTotalChats((total) => total + 1);
          }

          return [event.chat, ...withoutUpdated];
        });
        return;
      }

      if (
        event.type === 'message-created' &&
        event.message.chatId === selectedChatId
      ) {
        setMessages((current) => mergeMessages(current, [event.message]));
        return;
      }

      if (event.type === 'message-status-updated') {
        setMessages((current) =>
          current.map((message) =>
            message.whatsappMessageId === event.whatsappMessageId
              ? { ...message, status: event.status }
              : message,
          ),
        );
      }
    });

    return unsubscribe;
  }, [accountId, search, selectedChatId, unreadOnly]);

  return {
    chats,
    totalChats,
    messages,
    selectedChat,
    loadingChats,
    loadingMoreChats,
    hasMoreChats: chats.length < totalChats,
    loadingMessages,
    loadingOlderMessages,
    hasOlderMessages,
    sendingMessage,
    startingConversation,
    error,
    selectChat,
    refreshChats,
    loadMoreChats,
    loadOlderMessages,
    sendMessage,
    startConversation,
  };
}
