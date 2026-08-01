import { useEffect } from 'react';
import type { WhatsAppConnectionState } from '../../../../shared/interfaces/desktop-api';
import type { WhatsAppAccount } from '../../../../shared/interfaces/whatsapp-account';

interface ConnectionModalProps {
  account: WhatsAppAccount;
  state: WhatsAppConnectionState | null;
  busy: boolean;
  onClose(): void;
  onConnect(): Promise<void>;
  onDisconnect(): Promise<void>;
  onRefresh(): Promise<void>;
}

export function ConnectionModal({
  account,
  state,
  busy,
  onClose,
  onConnect,
  onDisconnect,
  onRefresh,
}: ConnectionModalProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const currentAccount = state?.account ?? account;
  const isConnected = currentAccount.status === 'connected';
  const needsQr = currentAccount.status === 'qr_required';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="connection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">WHATSAPP BAĞLANTISI</span>
            <h2 id="connection-modal-title">{currentAccount.name}</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label="Pencereyi kapat"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="connection-status-row">
          <span className={`status-badge status-${currentAccount.status}`}>
            {currentAccount.status === 'connected'
              ? 'Bağlı'
              : currentAccount.status === 'connecting'
                ? 'Bağlanıyor'
                : currentAccount.status === 'qr_required'
                  ? 'QR kodu bekleniyor'
                  : currentAccount.status === 'error'
                    ? 'Bağlantı hatası'
                    : 'Bağlı değil'}
          </span>

          <span>{currentAccount.phoneNumber ?? 'Telefon numarası alınmadı'}</span>
        </div>

        <div className="qr-area">
          {needsQr && state?.qrDataUrl ? (
            <>
              <img
                className="qr-image"
                src={state.qrDataUrl}
                alt={`${currentAccount.name} hesabının WhatsApp QR kodu`}
              />
              <p>
                WhatsApp mobil uygulamasında <strong>Bağlı cihazlar</strong>{' '}
                bölümünü açıp bu kodu okutun.
              </p>
            </>
          ) : isConnected ? (
            <div className="connection-success">
              <strong>WhatsApp hesabı bağlı</strong>
              <span>
                Bu hesap artık mesajlaşma ve kampanya modüllerinde kullanılabilir.
              </span>
            </div>
          ) : (
            <div className="connection-placeholder">
              <strong>Bağlantı başlatılmadı</strong>
              <span>QR kodu oluşturmak için Bağlantıyı Başlat düğmesine basın.</span>
            </div>
          )}
        </div>

        {state?.message ? <p className="connection-message">{state.message}</p> : null}

        <footer className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void onRefresh()}
          >
            Durumu Yenile
          </button>

          {isConnected ? (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => void onDisconnect()}
            >
              {busy ? 'Kesiliyor...' : 'Bağlantıyı Kes'}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void onConnect()}
            >
              {busy ? 'Başlatılıyor...' : 'Bağlantıyı Başlat'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
