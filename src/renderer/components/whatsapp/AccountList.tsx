import type { WhatsAppAccount } from '../../../../shared/interfaces/whatsapp-account';

interface AccountListProps {
  accounts: WhatsAppAccount[];
  deletingAccountId: string | null;
  onDelete(accountId: string): Promise<void>;
  onManageConnection(account: WhatsAppAccount): void;
}

const statusLabels: Record<WhatsAppAccount['status'], string> = {
  disconnected: 'Bağlı değil',
  connecting: 'Bağlanıyor',
  qr_required: 'QR kodu gerekli',
  connected: 'Bağlı',
  error: 'Hata',
};

export function AccountList({
  accounts,
  deletingAccountId,
  onDelete,
  onManageConnection,
}: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="empty-state">
        <strong>Henüz WhatsApp hesabı eklenmedi.</strong>
        <span>İlk hesabı oluşturmak için yukarıdaki formu kullanın.</span>
      </div>
    );
  }

  return (
    <div className="account-list">
      {accounts.map((account) => (
        <article className="account-card" key={account.id}>
          <div className="account-card-main">
            <div className="account-icon">
              {account.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
            </div>

            <div className="account-details">
              <strong>{account.name}</strong>
              <span>{account.phoneNumber ?? 'Telefon numarası henüz alınmadı'}</span>
              <small>ID: {account.id}</small>
            </div>
          </div>

          <div className="account-actions">
            <span className={`status-badge status-${account.status}`}>
              {statusLabels[account.status]}
            </span>

            <button
              className="secondary-button"
              type="button"
              onClick={() => onManageConnection(account)}
            >
              {account.status === 'connected' ? 'Bağlantıyı Yönet' : 'Bağlan'}
            </button>

            <button
              className="danger-button"
              type="button"
              disabled={deletingAccountId === account.id}
              onClick={() => void onDelete(account.id)}
            >
              {deletingAccountId === account.id ? 'Siliniyor...' : 'Sil'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
