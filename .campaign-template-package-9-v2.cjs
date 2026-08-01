const fs = require('fs');

const filePath = 'src/renderer/pages/CampaignPage.tsx';

function backup(path) {
  if (fs.existsSync(path)) {
    fs.copyFileSync(
      path,
      `${path}.before-campaign-template-integration-package-9-v2.bak`,
    );
  }
}

function requireFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Dosya bulunamadı: ${path}`);
  }
}

function insertAfter(source, anchor, addition, label) {
  if (!source.includes(anchor)) {
    throw new Error(`${label} bulunamadı.`);
  }

  return source.replace(anchor, `${anchor}${addition}`);
}

requireFile(filePath);
backup(filePath);

let source = fs.readFileSync(filePath, 'utf8');

if (source.includes('selectedTemplateId')) {
  console.log('Kampanya şablon entegrasyonu zaten uygulanmış.');
  process.exit(0);
}

/*
 * 1. MessageTemplate import
 */
const campaignImportEnd =
  "} from '../../../shared/interfaces/campaign';";

if (!source.includes(campaignImportEnd)) {
  throw new Error('Campaign type import bloğu bulunamadı.');
}

source = source.replace(
  campaignImportEnd,
  `${campaignImportEnd}
import type {
  MessageTemplate,
  MessageTemplateListRequest,
} from '../../../shared/interfaces/message-template';`,
);

/*
 * 2. API type
 * Paket 7 ve farklı ara sürümlerde imza değişebildiği için
 * CampaignApi kapanışından hemen önce eklenir.
 */
const campaignApiStart = source.indexOf('type CampaignApi =');
const campaignApiEnd = source.indexOf('\n};', campaignApiStart);

if (campaignApiStart < 0 || campaignApiEnd < 0) {
  throw new Error('CampaignApi tipi bulunamadı.');
}

source =
  source.slice(0, campaignApiEnd) +
  `
  listMessageTemplates(
    request: MessageTemplateListRequest,
  ): Promise<MessageTemplate[]>;` +
  source.slice(campaignApiEnd);

/*
 * 3. State alanları
 */
const noticeStateRegex =
  /  const \[notice, setNotice\] = useState<string \| null>\(null\);/;

if (!noticeStateRegex.test(source)) {
  throw new Error('CampaignPage notice state alanı bulunamadı.');
}

source = source.replace(
  noticeStateRegex,
  (match) => `${match}
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);`,
);

/*
 * 4. Şablonları ayrı useEffect ile yükle.
 * Önceki sürümde foundation Promise yapısına bağımlılık vardı.
 * V2 tamamen bağımsızdır.
 */
const firstEffectPosition = source.indexOf('  useEffect(() => {');

if (firstEffectPosition < 0) {
  throw new Error('CampaignPage useEffect bölümü bulunamadı.');
}

const templateEffect = `  useEffect(() => {
    let cancelled = false;

    void api
      .listMessageTemplates({ search: '' })
      .then((nextTemplates) => {
        if (!cancelled) {
          setTemplates(nextTemplates);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(readError(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

`;

source =
  source.slice(0, firstEffectPosition) +
  templateEffect +
  source.slice(firstEffectPosition);

/*
 * 5. openNew ve openEdit sıfırlamaları.
 */
const openNewStart = source.indexOf('  const openNew = (): void => {');
const openEditStart = source.indexOf(
  '  const openEdit = (campaign: Campaign): void => {',
);

if (openNewStart < 0 || openEditStart < 0) {
  throw new Error('openNew veya openEdit fonksiyonu bulunamadı.');
}

const openNewEnd = source.indexOf('\n  };', openNewStart);
const openEditEnd = source.indexOf('\n  };', openEditStart);

if (openNewEnd < 0 || openEditEnd < 0) {
  throw new Error('Kampanya form açma fonksiyonları okunamadı.');
}

let openNewBlock = source.slice(openNewStart, openNewEnd);
if (!openNewBlock.includes("setSelectedTemplateId('')")) {
  openNewBlock = openNewBlock.replace(
    /(\n\s*setFormOpen\(true\);)/,
    `
    setSelectedTemplateId('');
    setTemplateSearch('');
    setTemplatePanelOpen(false);$1`,
  );
  source =
    source.slice(0, openNewStart) +
    openNewBlock +
    source.slice(openNewEnd);
}

const refreshedOpenEditStart = source.indexOf(
  '  const openEdit = (campaign: Campaign): void => {',
);
const refreshedOpenEditEnd = source.indexOf(
  '\n  };',
  refreshedOpenEditStart,
);
let openEditBlock = source.slice(
  refreshedOpenEditStart,
  refreshedOpenEditEnd,
);

if (!openEditBlock.includes("setSelectedTemplateId('')")) {
  openEditBlock = openEditBlock.replace(
    /(\n\s*setFormOpen\(true\);)/,
    `
    setSelectedTemplateId('');
    setTemplateSearch('');
    setTemplatePanelOpen(false);$1`,
  );
  source =
    source.slice(0, refreshedOpenEditStart) +
    openEditBlock +
    source.slice(refreshedOpenEditEnd);
}

/*
 * 6. Helper fonksiyonlar.
 */
const toggleValueAnchor = '  const toggleValue = (';

if (!source.includes(toggleValueAnchor)) {
  throw new Error('toggleValue fonksiyonu bulunamadı.');
}

const helpers = `  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLocaleLowerCase('tr-TR');

    if (!query) {
      return templates;
    }

    return templates.filter((template) => {
      const searchable = [
        template.name,
        template.category ?? '',
        template.content,
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');

      return searchable.includes(query);
    });
  }, [templateSearch, templates]);

  const applyTemplate = (template: MessageTemplate): void => {
    setSelectedTemplateId(template.id);
    setForm((current) => ({
      ...current,
      message: template.content,
    }));
    setTemplatePanelOpen(false);
    setNotice(
      \`“\${template.name}” şablonu kampanya mesajına uygulandı.\`,
    );
  };

  const clearTemplateSelection = (): void => {
    setSelectedTemplateId('');
    setForm((current) => ({
      ...current,
      message: '',
    }));
  };

`;

source = source.replace(
  toggleValueAnchor,
  helpers + toggleValueAnchor,
);

/*
 * 7. Mesaj textarea alanından önce şablon paneli.
 * label metnine göre daha esnek bulunur.
 */
const messageLabel =
  '<label htmlFor="campaign-message">Mesaj</label>';
const messageLabelPosition = source.indexOf(messageLabel);

if (messageLabelPosition < 0) {
  throw new Error('Kampanya mesaj alanı bulunamadı.');
}

const messageContainerStart = source.lastIndexOf(
  '              <div',
  messageLabelPosition,
);

if (messageContainerStart < 0) {
  throw new Error('Kampanya mesaj alanı kapsayıcısı bulunamadı.');
}

const templateUi = `              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: 14,
                  border: '1px solid #29415b',
                  borderRadius: 13,
                  background: '#0a192a',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>Mesaj Şablonu</strong>
                    <p
                      style={{
                        margin: '5px 0 0',
                        color: '#7188a2',
                        fontSize: 12,
                      }}
                    >
                      Hazır bir mesaj seçin veya mesajı manuel yazın.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedTemplateId ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={clearTemplateSelection}
                        disabled={saving}
                      >
                        Seçimi Temizle
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setTemplatePanelOpen((current) => !current)
                      }
                      disabled={saving}
                    >
                      {templatePanelOpen
                        ? 'Şablonları Gizle'
                        : 'Şablon Seç'}
                    </button>
                  </div>
                </div>

                {selectedTemplateId ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      color: '#8ee9d8',
                      background: '#10283d',
                    }}
                  >
                    Seçili şablon:{' '}
                    <strong>
                      {templates.find(
                        (template) =>
                          template.id === selectedTemplateId,
                      )?.name ?? 'Şablon'}
                    </strong>
                  </div>
                ) : null}

                {templatePanelOpen ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="form-field">
                      <label htmlFor="campaign-template-search">
                        Şablonlarda ara
                      </label>
                      <input
                        id="campaign-template-search"
                        type="search"
                        value={templateSearch}
                        onChange={(event) =>
                          setTemplateSearch(event.target.value)
                        }
                        placeholder="Şablon adı, kategori veya mesaj"
                        disabled={saving}
                      />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 10,
                        maxHeight: 280,
                        overflowY: 'auto',
                        marginTop: 12,
                      }}
                    >
                      {filteredTemplates.length === 0 ? (
                        <div
                          style={{
                            gridColumn: '1 / -1',
                            padding: 18,
                            textAlign: 'center',
                            color: '#7188a2',
                          }}
                        >
                          Uygun mesaj şablonu bulunamadı.
                        </div>
                      ) : (
                        filteredTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            disabled={saving}
                            style={{
                              padding: 12,
                              border:
                                selectedTemplateId === template.id
                                  ? '1px solid #49cdb8'
                                  : '1px solid #29415b',
                              borderRadius: 11,
                              textAlign: 'left',
                              color: '#dfeaf5',
                              background:
                                selectedTemplateId === template.id
                                  ? '#10323a'
                                  : '#091727',
                              cursor: 'pointer',
                            }}
                          >
                            <strong
                              style={{
                                display: 'block',
                                marginBottom: 5,
                              }}
                            >
                              {template.name}
                            </strong>
                            <span
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                color: '#7f98b4',
                                fontSize: 12,
                              }}
                            >
                              {template.category || 'Kategorisiz'}
                            </span>
                            <small
                              style={{
                                display: '-webkit-box',
                                overflow: 'hidden',
                                color: '#9fb2c7',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 3,
                              }}
                            >
                              {template.content}
                            </small>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

`;

source =
  source.slice(0, messageContainerStart) +
  templateUi +
  source.slice(messageContainerStart);

/*
 * 8. Manuel mesaj değiştiğinde seçili şablonu kaldır.
 * İlk message textarea onChange bloğu esnek regex ile güncellenir.
 */
const messageTextAreaPosition = source.indexOf(
  'id="campaign-message"',
);

if (messageTextAreaPosition < 0) {
  throw new Error('campaign-message textarea bulunamadı.');
}

const onChangePosition = source.indexOf(
  'onChange={(event) =>',
  messageTextAreaPosition,
);

if (onChangePosition < 0) {
  throw new Error('Kampanya mesaj onChange alanı bulunamadı.');
}

const onChangeEndMarker = '\n                  }';
const onChangeEnd = source.indexOf(
  onChangeEndMarker,
  onChangePosition,
);

if (onChangeEnd < 0) {
  throw new Error('Kampanya mesaj onChange bloğu tamamlanamadı.');
}

const oldOnChange = source.slice(
  onChangePosition,
  onChangeEnd + onChangeEndMarker.length,
);

const newOnChange = `onChange={(event) => {
                    setSelectedTemplateId('');
                    setForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }));
                  }}`;

source = source.replace(oldOnChange, newOnChange);

fs.writeFileSync(filePath, source, 'utf8');

console.log('Güncellendi:', filePath);
console.log('');
console.log('Kampanya şablon entegrasyonu V2 tamamlandı.');
