import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import type {
  MessageTemplate,
  MessageTemplateListRequest,
  MessageTemplateMarkUsedRequest,
  MessageTemplateMarkUsedResult,
  MessageTemplateSaveInput,
} from '../../../shared/interfaces/message-template';

type TemplateApi = typeof window.desktopAPI & {
  listMessageTemplates(
    request: MessageTemplateListRequest,
  ): Promise<MessageTemplate[]>;
  saveMessageTemplate(
    input: MessageTemplateSaveInput,
  ): Promise<MessageTemplate>;
  deleteMessageTemplate(
    request: { id: string },
  ): Promise<{ deleted: boolean }>;
  markMessageTemplateUsed(
    request: MessageTemplateMarkUsedRequest,
  ): Promise<MessageTemplateMarkUsedResult>;
};

const EMPTY_FORM: MessageTemplateSaveInput = {
  name: '',
  category: '',
  content: '',
  isFavorite: false,
};

function readError(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Beklenmeyen bir şablon hatası oluştu.';
}

function formatDate(value: string | null): string {
  if (!value) return 'Henüz kullanılmadı';

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function MessageTemplatesPage() {
  const api = window.desktopAPI as TemplateApi;
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] =
    useState<MessageTemplateSaveInput>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const favoriteCount = useMemo(
    () => templates.filter((template) => template.isFavorite).length,
    [templates],
  );

  const totalUsage = useMemo(
    () => templates.reduce(
      (sum, template) => sum + template.usageCount,
      0,
    ),
    [templates],
  );

  const loadTemplates = useCallback(async (): Promise<void> => {
    try {
      setTemplates(
        await api.listMessageTemplates({ search }),
      );
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }, [api, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTemplates();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [loadTemplates]);

  const openNew = (): void => {
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (template: MessageTemplate): void => {
    setForm({
      id: template.id,
      name: template.name,
      category: template.category ?? '',
      content: template.content,
      isFavorite: template.isFavorite,
    });
    setError(null);
    setFormOpen(true);
  };

  const save = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const saved = await api.saveMessageTemplate(form);
      setNotice(`“${saved.name}” şablonu kaydedildi.`);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await loadTemplates();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (
    template: MessageTemplate,
  ): Promise<void> => {
    if (
      !window.confirm(
        `“${template.name}” şablonu silinsin mi?`,
      )
    ) {
      return;
    }

    setWorkingId(template.id);
    try {
      await api.deleteMessageTemplate({ id: template.id });
      setNotice('Şablon silindi.');
      await loadTemplates();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setWorkingId(null);
    }
  };

  const toggleFavorite = async (
    template: MessageTemplate,
  ): Promise<void> => {
    setWorkingId(template.id);
    setError(null);

    try {
      await api.saveMessageTemplate({
        id: template.id,
        name: template.name,
        category: template.category,
        content: template.content,
        isFavorite: !template.isFavorite,
      });
      setNotice(
        template.isFavorite
          ? 'Şablon favorilerden çıkarıldı.'
          : 'Şablon favorilere eklendi.',
      );
      await loadTemplates();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setWorkingId(null);
    }
  };

  const duplicate = async (
    template: MessageTemplate,
  ): Promise<void> => {
    setWorkingId(template.id);
    setError(null);

    try {
      const copy = await api.saveMessageTemplate({
        name: `${template.name} - Kopya`,
        category: template.category,
        content: template.content,
        isFavorite: false,
      });
      setNotice(`“${copy.name}” oluşturuldu.`);
      await loadTemplates();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setWorkingId(null);
    }
  };

  const copyContent = async (
    template: MessageTemplate,
  ): Promise<void> => {
    await navigator.clipboard.writeText(template.content);
    setNotice('Mesaj panoya kopyalandı.');
  };

  return (
    <section className="accounts-page">
      <div
        className="page-card"
        style={{ width: 'min(1380px, 100%)' }}
      >
        <header className="page-header">
          <div>
            <span className="eyebrow">MESAJ KÜTÜPHANESİ</span>
            <h1>Mesaj Şablonları</h1>
            <p>
              Kendi mesaj şablonlarınızı oluşturun, kaydedin,
              düzenleyin ve kampanyalarda yeniden kullanın.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openNew}
          >
            Yeni Şablon
          </button>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}>
          <div className="account-count">
            <span>Toplam şablon</span>
            <strong>{templates.length}</strong>
          </div>
          <div className="account-count">
            <span>Favori</span>
            <strong>{favoriteCount}</strong>
          </div>
          <div className="account-count">
            <span>Toplam kullanım</span>
            <strong>{totalUsage}</strong>
          </div>
        </div>

        {error ? (
          <div className="error-message">{error}</div>
        ) : null}

        {notice ? (
          <div
            style={{
              marginBottom: 14,
              padding: '12px 14px',
              border: '1px solid #255f59',
              borderRadius: 12,
              color: '#87ead9',
              background: '#0b292b',
            }}
          >
            {notice}
          </div>
        ) : null}

        <section className="panel">
          <div
            className="form-field"
            style={{ marginBottom: 18 }}
          >
            <label htmlFor="template-search">
              Şablonlarda ara
            </label>
            <input
              id="template-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Ad, kategori veya mesaj"
            />
          </div>

          {templates.length === 0 ? (
            <div className="empty-state">
              <strong>Mesaj şablonu bulunamadı</strong>
              <span>
                Hazır şablon sunulmaz. İlk şablonunuzu kendi
                ihtiyacınıza göre oluşturun.
              </span>
              <button
                type="button"
                className="primary-button"
                onClick={openNew}
                style={{ marginTop: 14 }}
              >
                İlk Şablonu Oluştur
              </button>
            </div>
          ) : (
            <div className="account-list">
              {templates.map((template) => (
                <article
                  className="account-card"
                  key={template.id}
                  style={{
                    borderColor: template.isFavorite
                      ? '#8a7135'
                      : undefined,
                  }}
                >
                  <div className="account-card-main">
                    <span className="account-icon">
                      {template.isFavorite ? '★' : 'Ş'}
                    </span>
                    <div className="account-details">
                      <strong>{template.name}</strong>
                      <span>
                        {template.category || 'Kategorisiz'}
                        {' · '}
                        {template.usageCount} kullanım
                      </span>
                      <small>
                        Son kullanım: {formatDate(template.lastUsedAt)}
                      </small>
                      <small
                        style={{
                          display: 'block',
                          maxWidth: 720,
                          marginTop: 5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {template.content}
                      </small>
                    </div>
                  </div>

                  <div className="account-actions" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={workingId === template.id}
                      onClick={() => void toggleFavorite(template)}
                    >
                      {template.isFavorite
                        ? 'Favoriden Çıkar'
                        : 'Favoriye Ekle'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={workingId === template.id}
                      onClick={() => void duplicate(template)}
                    >
                      Çoğalt
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void copyContent(template)
                      }
                    >
                      Kopyala
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={workingId === template.id}
                      onClick={() => openEdit(template)}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={workingId === template.id}
                      onClick={() => void remove(template)}
                    >
                      Sil
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {formOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form
            className="connection-modal"
            style={{ width: 'min(760px, 100%)' }}
            onSubmit={save}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">
                  KULLANICI MESAJ ŞABLONU
                </span>
                <h2>
                  {form.id
                    ? 'Şablonu Düzenle'
                    : 'Yeni Şablon'}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                ×
              </button>
            </header>

            <div style={{ marginTop: 22 }}>
              <div className="form-field">
                <label htmlFor="template-name">
                  Şablon adı
                </label>
                <input
                  id="template-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  maxLength={120}
                  required
                />
              </div>

              <div
                className="form-field"
                style={{ marginTop: 16 }}
              >
                <label htmlFor="template-category">
                  Kategori
                </label>
                <input
                  id="template-category"
                  value={form.category ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Tanıtım, takip, randevu..."
                />
              </div>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 16,
              }}>
                <input
                  type="checkbox"
                  checked={form.isFavorite === true}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isFavorite: event.target.checked,
                    }))
                  }
                />
                Favorilere ekle
              </label>

              <div
                className="form-field"
                style={{ marginTop: 16 }}
              >
                <label htmlFor="template-content">
                  Mesaj
                </label>
                <textarea
                  id="template-content"
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  rows={9}
                  maxLength={4096}
                  required
                  style={{
                    width: '100%',
                    padding: 14,
                    border: '1px solid #314a68',
                    borderRadius: 11,
                    resize: 'vertical',
                    color: '#fff',
                    background: '#091727',
                    font: 'inherit',
                  }}
                />
                <small
                  style={{
                    display: 'block',
                    marginTop: 6,
                    textAlign: 'right',
                    color: '#7188a2',
                  }}
                >
                  {(form.content ?? '').length} / 4096
                </small>
              </div>
            </div>

            <footer className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
