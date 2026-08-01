import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhatsAppConnectionState } from '../../../shared/interfaces/desktop-api';
import type { WhatsAppAccount } from '../../../shared/interfaces/whatsapp-account';
import {
  reportTechnicalError,
  toUserErrorMessage,
} from '../services/error-message.service';
import { AccountForm } from '../components/whatsapp/AccountForm';
import { AccountList } from '../components/whatsapp/AccountList';
import { ConnectionModal } from '../components/whatsapp/ConnectionModal';

export function WhatsAppAccountsPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccount, setSelectedAccount] =
    useState<WhatsAppAccount | null>(null);
  const [connectionState, setConnectionState] =
    useState<WhatsAppConnectionState | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accountFormVersion, setAccountFormVersion] = useState(0);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [deletingAccountId, setDeletingAccountId] =
    useState<string | null>(null);
  const [error, setError] = useState('');

  const selectedAccountIdRef = useRef<string | null>(null);

  const updateAccountInList = useCallback(
    (updatedAccount: WhatsAppAccount): void => {
      setAccounts((current) =>
        current.map((account) =>
          account.id === updatedAccount.id ? updatedAccount : account,
        ),
      );
    },
    [],
  );

  const loadAccounts = useCallback(async (): Promise<void> => {
    try {
      setError('');
      const nextAccounts =
        await window.desktopAPI.listWhatsAppAccounts();
      setAccounts(nextAccounts);
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/List', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp hesapları yüklenemedi. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshConnectionState = useCallback(async (): Promise<void> => {
    const accountId = selectedAccountIdRef.current;
    if (!accountId) return;

    try {
      const nextState =
        await window.desktopAPI.getWhatsAppConnectionState(accountId);

      if (selectedAccountIdRef.current !== accountId) return;

      setConnectionState(nextState);
      setSelectedAccount(nextState.account);
      updateAccountInList(nextState.account);
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/Action', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp bağlantı durumu alınamadı. Lütfen tekrar deneyin.',
        ),
      );
    }
  }, [updateAccountInList]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!selectedAccount) return undefined;

    selectedAccountIdRef.current = selectedAccount.id;
    void refreshConnectionState();

    const timer = window.setInterval(() => {
      void refreshConnectionState();
    }, 1500);

    return () => {
      window.clearInterval(timer);
      selectedAccountIdRef.current = null;
    };
  }, [refreshConnectionState, selectedAccount]);

  async function handleCreate(name: string): Promise<void> {
    try {
      setCreating(true);
      setError('');

      const created =
        await window.desktopAPI.createWhatsAppAccount({ name });

      setAccounts((current) => [created, ...current]);
      setAccountFormVersion((current) => current + 1);
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/Action', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp hesabı oluşturulamadı. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(accountId: string): Promise<void> {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;

    const confirmed = window.confirm(
      `"${account.name}" hesabı ve yerel oturum klasörü silinsin mi?`,
    );

    if (!confirmed) return;

    try {
      setDeletingAccountId(accountId);
      setError('');

      const result =
        await window.desktopAPI.deleteWhatsAppAccount(accountId);

      if (!result.success) {
        throw new Error('Hesap bulunamadı veya silinemedi.');
      }

      setAccounts((current) =>
        current.filter((item) => item.id !== accountId),
      );
      setAccountFormVersion((current) => current + 1);

      if (selectedAccount?.id === accountId) {
        closeConnectionModal();
      }
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/Action', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp hesabı silinemedi. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      setDeletingAccountId(null);
    }
  }

  function openConnectionModal(account: WhatsAppAccount): void {
    selectedAccountIdRef.current = account.id;
    setSelectedAccount(account);
    setConnectionState(null);
    setError('');
  }

  function closeConnectionModal(): void {
    selectedAccountIdRef.current = null;
    setSelectedAccount(null);
    setConnectionState(null);
    setConnectionBusy(false);
  }

  async function handleConnect(): Promise<void> {
    if (!selectedAccount) return;

    try {
      setConnectionBusy(true);
      setError('');

      const nextState =
        await window.desktopAPI.connectWhatsAppAccount(
          selectedAccount.id,
        );

      setConnectionState(nextState);
      setSelectedAccount(nextState.account);
      updateAccountInList(nextState.account);
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/Action', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp bağlantısı başlatılamadı. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      setConnectionBusy(false);
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (!selectedAccount) return;

    const accountId = selectedAccount.id;

    setConnectionBusy(true);
    setError('');
    closeConnectionModal();

    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? {
              ...account,
              status: 'disconnected',
              phoneNumber: null,
              lastConnectedAt: null,
            }
          : account,
      ),
    );

    try {
      const nextState =
        await window.desktopAPI.disconnectWhatsAppAccount(accountId);

      updateAccountInList(nextState.account);
    } catch (reason: unknown) {
      reportTechnicalError('Accounts/Action', reason);
      setError(
        toUserErrorMessage(
          reason,
          'WhatsApp bağlantısı kesilemedi. Lütfen tekrar deneyin.',
        ),
      );

      await loadAccounts();
    } finally {
      setConnectionBusy(false);
    }
  }

  return (
    <section className="accounts-page">
      <section className="page-card">
        <header className="page-header">
          <div>
            <span className="eyebrow">AI OPERASYON</span>
            <h1>WhatsApp Hesapları</h1>
            <p>
              Bağlanacak her numara için ayrı yerel hesap ve oturum kaydı
              oluşturun.
            </p>
          </div>

          <div className="account-count">
            <span>Toplam hesap</span>
            <strong>{accounts.length}</strong>
          </div>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Yeni hesap ekle</h2>
              <p>
                Her hesap için bağımsız bir Baileys oturum klasörü hazırlanır.
              </p>
            </div>
          </div>

          <AccountForm
            key={accountFormVersion}
            busy={creating}
            onCreate={handleCreate}
          />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Kayıtlı hesaplar</h2>
              <p>
                Hesabı seçerek QR bağlantısını başlatabilir veya mevcut
                bağlantıyı yönetebilirsiniz.
              </p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadAccounts()}
            >
              Yenile
            </button>
          </div>

          {error ? <p className="error-message">{error}</p> : null}

          {loading ? (
            <div className="empty-state">Hesaplar yükleniyor...</div>
          ) : (
            <AccountList
              accounts={accounts}
              deletingAccountId={deletingAccountId}
              onDelete={handleDelete}
              onManageConnection={openConnectionModal}
            />
          )}
        </section>
      </section>

      {selectedAccount ? (
        <ConnectionModal
          account={selectedAccount}
          state={connectionState}
          busy={connectionBusy}
          onClose={closeConnectionModal}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onRefresh={refreshConnectionState}
        />
      ) : null}
    </section>
  );
}
