import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from 'react';
import type {
  InboxChat,
  InboxMessage,
} from '../../../../shared/interfaces/inbox';
import type {
  CrmContact,
  CrmContactSnapshot,
} from '../../../../shared/interfaces/crm';
import { useInbox } from '../../hooks/use-inbox';
import './inbox.css';

interface InboxPageProps {
  accountId: string | null;
  accountName?: string | null;
}

function formatTime(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function chatTitle(chat: InboxChat): string {
  return chat.displayName || chat.phoneNumber || chat.jid;
}

function messageStatus(message: InboxMessage): string {
  if (message.direction === 'incoming') return '';

  const labels: Record<InboxMessage['status'], string> = {
    pending: 'Bekliyor',
    sent: 'Gönderildi',
    delivered: 'İletildi',
    read: 'Okundu',
    failed: 'Başarısız',
  };

  return labels[message.status];
}

export function InboxPage({
  accountId,
  accountName,
}: InboxPageProps) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const {
    chats,
    totalChats,
    messages,
    selectedChat,
    loadingChats,
    loadingMoreChats,
    hasMoreChats,
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
  } = useInbox(accountId, {
    search,
    unreadOnly,
  });

  const [draft, setDraft] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newConversationText, setNewConversationText] = useState('');
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [crmContactSearch, setCrmContactSearch] = useState('');
  const [crmContactsLoading, setCrmContactsLoading] = useState(false);
  const [selectedCrmContactId, setSelectedCrmContactId] =
    useState('');
  const [deletingChat, setDeletingChat] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
  } | null>(null);
  const previousChatIdRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto'): void => {
    const element = messageListRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
  };

  const handleMessageScroll = (
    event: UIEvent<HTMLDivElement>,
  ): void => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 90;
  };

  const handleLoadOlder = async (): Promise<void> => {
    const element = messageListRef.current;

    if (element) {
      preserveScrollRef.current = {
        height: element.scrollHeight,
        top: element.scrollTop,
      };
    }

    const loadedCount = await loadOlderMessages();

    if (loadedCount === 0) {
      preserveScrollRef.current = null;
    }
  };


  const handleDeleteSelectedChat = async (): Promise<void> => {
    if (!accountId || !selectedChat || deletingChat) return;

    const confirmed = window.confirm(
      `"${chatTitle(selectedChat)}" sohbeti WhatsApp'tan ve ` +
        'bu uygulamadaki yerel geçmişten silinsin mi? ' +
        'Bu işlem geri alınamaz.',
    );

    if (!confirmed) return;

    setDeletingChat(true);

    try {
      const api = window.desktopAPI as typeof window.desktopAPI & {
        deleteInboxChat(request: {
          accountId: string;
          chatId: string;
        }): Promise<{ deleted: boolean }>;
      };

      await api.deleteInboxChat({
        accountId,
        chatId: selectedChat.id,
      });

      await refreshChats();
    } catch (reason: unknown) {
      console.error('[Inbox/DeleteChat]', reason);
      const message =
        reason instanceof Error
          ? reason.message
          : 'Bilinmeyen sohbet silme hatası.';

      window.alert(
        `Sohbet silinemedi: ${message}`,
      );
    } finally {
      setDeletingChat(false);
    }
  };

  const loadCrmContacts = async (
    searchValue = '',
  ): Promise<void> => {
    setCrmContactsLoading(true);

    try {
      const api = window.desktopAPI as typeof window.desktopAPI & {
        listCrmContacts(request: {
          search?: string;
          permissionStatus?: 'allowed' | 'blocked' | 'all';
          limit?: number;
          offset?: number;
        }): Promise<CrmContactSnapshot>;
      };

      const snapshot = await api.listCrmContacts({
        search: searchValue,
        permissionStatus: 'allowed',
        limit: 100,
        offset: 0,
      });

      setCrmContacts(snapshot.contacts);
    } catch (reason: unknown) {
      console.error('[Inbox/CRMContacts]', reason);
      setCrmContacts([]);
    } finally {
      setCrmContactsLoading(false);
    }
  };

  const openNewConversation = (): void => {
    setNewConversationOpen(true);
    setSelectedCrmContactId('');
    setCrmContactSearch('');
    void loadCrmContacts();
  };

  const closeNewConversation = (): void => {
    if (startingConversation) return;

    setNewConversationOpen(false);
    setSelectedCrmContactId('');
    setCrmContactSearch('');
  };

  const selectCrmContact = (contactId: string): void => {
    setSelectedCrmContactId(contactId);

    const contact = crmContacts.find(
      (item) => item.id === contactId,
    );

    if (contact) {
      setNewPhoneNumber(contact.phoneNumber);
    }
  };

  const handleStartConversation = async (): Promise<void> => {
    const chat = await startConversation(
      newPhoneNumber,
      newConversationText,
    );

    if (!chat) return;

    setNewConversationOpen(false);
    setNewPhoneNumber('');
    setNewConversationText('');
    setSelectedCrmContactId('');
    setCrmContactSearch('');
    shouldAutoScrollRef.current = true;
  };

  const handleSend = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || sendingMessage) return;

    shouldAutoScrollRef.current = true;
    const sent = await sendMessage(text);

    if (sent) {
      setDraft('');
      requestAnimationFrame(() => scrollToBottom('smooth'));
    }
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  useEffect(() => {
    setDraft('');
    shouldAutoScrollRef.current = true;
    preserveScrollRef.current = null;
  }, [selectedChat?.id]);

  useLayoutEffect(() => {
    const element = messageListRef.current;
    if (!element) return;

    if (preserveScrollRef.current) {
      const previous = preserveScrollRef.current;
      const heightDifference = element.scrollHeight - previous.height;
      element.scrollTop = previous.top + heightDifference;
      preserveScrollRef.current = null;
      return;
    }

    const chatChanged = previousChatIdRef.current !== selectedChat?.id;
    const messageAdded =
      messages.length > previousMessageCountRef.current;

    if (
      selectedChat &&
      (chatChanged || (messageAdded && shouldAutoScrollRef.current))
    ) {
      scrollToBottom(chatChanged ? 'auto' : 'smooth');
    }

    previousChatIdRef.current = selectedChat?.id ?? null;
    previousMessageCountRef.current = messages.length;
  }, [messages, selectedChat?.id]);

  if (!accountId) {
    return (
      <section className="inbox-empty-page">
        <h2>Gelen Kutusu</h2>
        <p>Mesajları görüntülemek için bağlı bir WhatsApp hesabı seçin.</p>
      </section>
    );
  }

  return (
    <section className="inbox-page">
      <header className="inbox-page__header">
        <div>
          <p className="inbox-page__eyebrow">WhatsApp Gelen Kutusu</p>
          <h2>{accountName || 'Seçili Hesap'}</h2>
        </div>

        <div className="inbox-page__actions">
          <button
            type="button"
            className="inbox-page__new-conversation"
            onClick={openNewConversation}
          >
            Yeni Sohbet
          </button>

          <button
            type="button"
            className="inbox-page__refresh"
            onClick={() => void refreshChats()}
            disabled={loadingChats}
          >
            {loadingChats ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>
      </header>

      {error ? <div className="inbox-page__error">{error}</div> : null}

      <div className="inbox-layout">
        <aside className="inbox-chat-list">
          <div className="inbox-chat-list__title">
            <strong>Sohbetler</strong>
            <span>{chats.length}/{totalChats}</span>
          </div>

          <div className="inbox-chat-list__filters">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="İsim, numara veya mesaj ara"
              aria-label="Sohbetlerde ara"
            />

            <button
              type="button"
              className={
                unreadOnly
                  ? 'inbox-unread-filter inbox-unread-filter--active'
                  : 'inbox-unread-filter'
              }
              onClick={() => setUnreadOnly((current) => !current)}
              aria-pressed={unreadOnly}
            >
              Okunmamış
            </button>
          </div>

          <div className="inbox-chat-list__items">
            {loadingChats && chats.length === 0 ? (
              <p className="inbox-placeholder">Sohbetler yükleniyor...</p>
            ) : null}

            {!loadingChats && chats.length === 0 ? (
              <p className="inbox-placeholder">Henüz kayıtlı sohbet yok.</p>
            ) : null}

            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={
                  chat.id === selectedChat?.id
                    ? 'inbox-chat inbox-chat--active'
                    : 'inbox-chat'
                }
                onClick={() => void selectChat(chat)}
              >
                <span className="inbox-chat__avatar">
                  {chatTitle(chat).slice(0, 1).toLocaleUpperCase('tr-TR')}
                </span>

                <span className="inbox-chat__body">
                  <span className="inbox-chat__top">
                    <strong>{chatTitle(chat)}</strong>
                    <small>{formatTime(chat.lastMessageAt)}</small>
                  </span>

                  <span className="inbox-chat__bottom">
                    <span>{chat.lastMessagePreview || 'Mesaj yok'}</span>
                    {chat.unreadCount > 0 ? (
                      <b>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</b>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}

            {hasMoreChats ? (
              <button
                type="button"
                className="inbox-load-more-chats"
                onClick={() => void loadMoreChats()}
                disabled={loadingMoreChats || loadingChats}
              >
                {loadingMoreChats
                  ? 'Sohbetler yükleniyor...'
                  : 'Daha fazla sohbet yükle'}
              </button>
            ) : null}
          </div>
        </aside>

        <main className="inbox-conversation">
          {!selectedChat ? (
            <div className="inbox-conversation__empty">
              <h3>Bir sohbet seçin</h3>
              <p>Mesaj geçmişi burada görüntülenecek.</p>
            </div>
          ) : (
            <>
              <header className="inbox-conversation__header">
                <div>
                  <strong>{chatTitle(selectedChat)}</strong>
                  <small>{selectedChat.phoneNumber || selectedChat.jid}</small>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {hasOlderMessages ? (
                    <button
                      type="button"
                      className="inbox-header-load-older"
                      onClick={() => void handleLoadOlder()}
                      disabled={loadingOlderMessages || loadingMessages}
                    >
                      {loadingOlderMessages
                        ? 'Yükleniyor...'
                        : 'Daha eski mesajları yükle'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleDeleteSelectedChat()}
                    disabled={deletingChat}
                    style={{
                      borderColor: '#7f3d48',
                      color: '#ffb9c2',
                    }}
                  >
                    {deletingChat ? 'Siliniyor...' : 'Sohbeti Sil'}
                  </button>
                </div>
              </header>

              <div
                ref={messageListRef}
                className="inbox-message-list"
                onScroll={handleMessageScroll}
              >
                {hasOlderMessages ? (
                  <button
                    type="button"
                    className="inbox-load-older"
                    onClick={() => void handleLoadOlder()}
                    disabled={loadingOlderMessages || loadingMessages}
                  >
                    {loadingOlderMessages
                      ? 'Eski mesajlar yükleniyor...'
                      : 'Daha eski mesajları yükle'}
                  </button>
                ) : messages.length > 0 ? (
                  <p className="inbox-history-start">
                    Sohbet geçmişinin başlangıcı
                  </p>
                ) : null}

                {loadingMessages ? (
                  <p className="inbox-placeholder">Mesajlar yükleniyor...</p>
                ) : null}

                {!loadingMessages && messages.length === 0 ? (
                  <p className="inbox-placeholder">Bu sohbette mesaj yok.</p>
                ) : null}

                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.direction === 'outgoing'
                        ? 'inbox-message inbox-message--outgoing'
                        : 'inbox-message inbox-message--incoming'
                    }
                  >
                    <p>{message.text || 'Desteklenmeyen mesaj'}</p>
                    <footer>
                      <time>{formatDateTime(message.timestamp)}</time>
                      {messageStatus(message) ? (
                        <span>{messageStatus(message)}</span>
                      ) : null}
                    </footer>
                  </article>
                ))}
              </div>

              <footer className="inbox-composer">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Mesaj yazın..."
                  rows={1}
                  maxLength={4096}
                  disabled={sendingMessage}
                  aria-label="WhatsApp mesajı"
                />

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || sendingMessage}
                >
                  {sendingMessage ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </footer>

              <p className="inbox-composer__hint">
                Enter: gönder · Shift+Enter: yeni satır
              </p>
            </>
          )}
        </main>
      </div>

      {newConversationOpen ? (
        <div
          className="inbox-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !startingConversation) {
              closeNewConversation();
            }
          }}
        >
          <section
            className="inbox-new-conversation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-conversation-title"
          >
            <header>
              <div>
                <p>WHATSAPP MESAJI</p>
                <h3 id="new-conversation-title">Yeni Sohbet Başlat</h3>
              </div>

              <button
                type="button"
                className="inbox-modal-close"
                onClick={closeNewConversation}
                disabled={startingConversation}
                aria-label="Pencereyi kapat"
              >
                ×
              </button>
            </header>

            <div className="inbox-crm-contact-picker">
              <div className="inbox-crm-contact-picker__title">
                <div>
                  <strong>CRM Kişisinden Seç</strong>
                  <small>
                    Yalnızca izinli CRM kişileri listelenir.
                  </small>
                </div>
                <span>{crmContacts.length} kişi</span>
              </div>

              <div className="inbox-crm-contact-picker__search">
                <input
                  type="search"
                  value={crmContactSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCrmContactSearch(value);
                    void loadCrmContacts(value);
                  }}
                  placeholder="Ad, firma, sektör, il veya telefon ara"
                  disabled={startingConversation}
                />
              </div>

              <select
                value={selectedCrmContactId}
                onChange={(event) =>
                  selectCrmContact(event.target.value)
                }
                disabled={
                  startingConversation || crmContactsLoading
                }
              >
                <option value="">
                  {crmContactsLoading
                    ? 'CRM kişileri yükleniyor...'
                    : 'CRM kişisi seçin'}
                </option>
                {crmContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.fullName}
                    {contact.companyName
                      ? ` — ${contact.companyName}`
                      : ''}
                    {contact.city ? ` — ${contact.city}` : ''}
                    {` — ${contact.phoneNumber}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="inbox-recipient-divider">
              <span>veya numarayı manuel girin</span>
            </div>
            <label>
              <span>Telefon numarası</span>
              <input
                value={newPhoneNumber}
                onChange={(event) => {
                  setSelectedCrmContactId('');
                  setNewPhoneNumber(
                    event.target.value.replace(
                      /[^\d+\s()-]/g,
                      '',
                    ),
                  );
                }}
                placeholder="905551112233"
                autoFocus
                disabled={startingConversation}
              />
              <small>
                Numarayı ülke koduyla birlikte girin. Örnek: 905551112233
              </small>
            </label>

            <label>
              <span>İlk mesaj</span>
              <textarea
                value={newConversationText}
                onChange={(event) =>
                  setNewConversationText(event.target.value)
                }
                placeholder="Mesajınızı yazın..."
                rows={5}
                maxLength={4096}
                disabled={startingConversation}
              />
            </label>

            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setNewConversationOpen(false)}
                disabled={startingConversation}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="inbox-modal-submit"
                onClick={() => void handleStartConversation()}
                disabled={
                  !newPhoneNumber.replace(/\D/g, '') ||
                  !newConversationText.trim() ||
                  startingConversation
                }
              >
                {startingConversation
                  ? 'Gönderiliyor...'
                  : 'Sohbeti Başlat'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
