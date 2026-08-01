import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WhatsAppAccount } from '../../../shared/interfaces/whatsapp-account';
import { InboxPage } from '../components/inbox/InboxPage';
import {
  reportTechnicalError,
  toUserErrorMessage,
} from '../services/error-message.service';

export function InboxWorkspacePage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const loadAccounts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const nextAccounts =
        await window.desktopAPI.listWhatsAppAccounts();

      setAccounts(nextAccounts);
      setSelectedAccountId((current) => {
        if (current && nextAccounts.some((account) => account.id === current)) {
          return current;
        }

        return (
          nextAccounts.find((account) => account.status === 'connected')?.id ??
          nextAccounts[0]?.id ??
          ''
        );
      });
    } catch (reason: unknown) {
      reportTechnicalError('InboxWorkspace/Accounts', reason);
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

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  if (loading) {
    return (
      <section className="workspace-state">
        <strong>Gelen kutusu hazırlanıyor...</strong>
        <span>WhatsApp hesapları yükleniyor.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="workspace-state workspace-state--error">
        <strong>Gelen kutusu açılamadı</strong>
        <span>{error}</span>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadAccounts()}
        >
          Tekrar dene
        </button>
      </section>
    );
  }

  if (accounts.length === 0) {
    return (
      <section className="workspace-state">
        <strong>Henüz WhatsApp hesabı yok</strong>
        <span>
          Gelen kutusunu kullanmak için önce Hesaplar bölümünden bir hesap
          oluşturun.
        </span>
      </section>
    );
  }

  return (
    <section className="inbox-workspace">
      <header className="inbox-workspace__toolbar">
        <div>
          <span className="eyebrow">MESAJ YÖNETİMİ</span>
          <h1>Gelen Kutusu</h1>
          <p>
            Her WhatsApp hesabının sohbetlerini ve mesaj geçmişini ayrı
            görüntüleyin.
          </p>
        </div>

        <label className="account-selector">
          <span>Görüntülenecek hesap</span>
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.phoneNumber ? ` — ${account.phoneNumber}` : ''}
                {account.status === 'connected' ? ' — Bağlı' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <InboxPage
        accountId={selectedAccount?.id ?? null}
        accountName={selectedAccount?.name ?? null}
      />
    </section>
  );
}
