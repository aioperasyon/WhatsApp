const fs = require('fs');

const files = {
  campaignInterface: 'shared/interfaces/campaign.ts',
  campaignPage: 'src/renderer/pages/CampaignPage.tsx',
  campaignBackend: 'src/main/ipc/register-campaign-ipc.ts',
};

function mustExist(file) {
  if (!fs.existsSync(file)) throw new Error(`Dosya bulunamadı: ${file}`);
}

function backup(file) {
  mustExist(file);
  fs.copyFileSync(file, `${file}.before-package-11.bak`);
}

function read(file) {
  mustExist(file);
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log('Güncellendi:', file);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`${label} bulunamadı.`);
  }
  return source.replace(search, replacement);
}

for (const file of Object.values(files)) backup(file);

const interfaceContent = Buffer.from(
  fs.readFileSync('.package-11-interface.b64', 'utf8').replace(/\s+/g, ''),
  'base64',
).toString('utf8');
write(files.campaignInterface, interfaceContent);

let page = read(files.campaignPage);

page = replaceOnce(
  page,
  `  status: 'draft',\n};`,
  `  status: 'draft',\n  description: '',\n  minDelaySeconds: 6,\n  maxDelaySeconds: 14,\n  batchSize: 30,\n  batchPauseMinSeconds: 45,\n  batchPauseMaxSeconds: 90,\n  dailyLimit: 250,\n  workStartTime: '09:00',\n  workEndTime: '18:30',\n  typingSimulation: true,\n  retryCount: 2,\n  scheduledAt: null,\n};`,
  'EMPTY_FORM ayarları',
);

page = replaceOnce(
  page,
  `    ready: 'Hazır',\n    running: 'Gönderiliyor',`,
  `    ready: 'Hazır',\n    scheduled: 'Planlandı',\n    running: 'Gönderiliyor',`,
  'scheduled durum etiketi',
);

page = replaceOnce(
  page,
  `      status: campaign.status === 'ready' ? 'ready' : 'draft',\n    });`,
  `      status:\n        campaign.status === 'ready' || campaign.status === 'scheduled'\n          ? campaign.status\n          : 'draft',\n      description: campaign.settings.description ?? '',\n      minDelaySeconds: campaign.settings.minDelaySeconds,\n      maxDelaySeconds: campaign.settings.maxDelaySeconds,\n      batchSize: campaign.settings.batchSize,\n      batchPauseMinSeconds: campaign.settings.batchPauseMinSeconds,\n      batchPauseMaxSeconds: campaign.settings.batchPauseMaxSeconds,\n      dailyLimit: campaign.settings.dailyLimit,\n      workStartTime: campaign.settings.workStartTime,\n      workEndTime: campaign.settings.workEndTime,\n      typingSimulation: campaign.settings.typingSimulation,\n      retryCount: campaign.settings.retryCount,\n      scheduledAt: campaign.settings.scheduledAt,\n    });`,
  'openEdit ayarları',
);

page = replaceOnce(
  page,
  `              <div className="form-field" style={{ gridColumn: '1 / -1' }}>\n                <label>Mesaj</label>`,
  `              <div className="form-field" style={{ gridColumn: '1 / -1' }}>\n                <label>Açıklama</label>\n                <input\n                  value={form.description ?? ''}\n                  onChange={(event) =>\n                    setForm((current) => ({\n                      ...current,\n                      description: event.target.value,\n                    }))\n                  }\n                  placeholder="Kampanyanın amacı veya iç not"\n                />\n              </div>\n\n              <div className="form-field" style={{ gridColumn: '1 / -1' }}>\n                <label>Mesaj</label>`,
  'açıklama alanı',
);

page = replaceOnce(
  page,
  `              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>\n                <input\n                  type="checkbox"\n                  checked={form.onlyAllowed !== false}`,
  `              <section style={{\n                gridColumn: '1 / -1',\n                padding: 16,\n                border: '1px solid #29415b',\n                borderRadius: 13,\n                background: '#0a192a',\n              }}>\n                <strong>Gönderim Ayarları</strong>\n                <p style={{ color: '#7188a2', fontSize: 12 }}>\n                  Paket 11 bu ayarları kampanyayla birlikte kaydeder.\n                  Gönderim motoru Paket 13'te bu değerleri uygulayacaktır.\n                </p>\n                <div style={{\n                  display: 'grid',\n                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',\n                  gap: 12,\n                  marginTop: 14,\n                }}>\n                  <div className="form-field">\n                    <label>Minimum bekleme (sn)</label>\n                    <input type="number" min="1" max="3600"\n                      value={form.minDelaySeconds ?? 6}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        minDelaySeconds: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Maksimum bekleme (sn)</label>\n                    <input type="number" min="1" max="3600"\n                      value={form.maxDelaySeconds ?? 14}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        maxDelaySeconds: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Günlük limit</label>\n                    <input type="number" min="0" max="100000"\n                      value={form.dailyLimit ?? 0}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        dailyLimit: Number(event.target.value) || null,\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Her kaç mesajda mola</label>\n                    <input type="number" min="0" max="10000"\n                      value={form.batchSize ?? 30}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        batchSize: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Minimum mola (sn)</label>\n                    <input type="number" min="0" max="86400"\n                      value={form.batchPauseMinSeconds ?? 45}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        batchPauseMinSeconds: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Maksimum mola (sn)</label>\n                    <input type="number" min="0" max="86400"\n                      value={form.batchPauseMaxSeconds ?? 90}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        batchPauseMaxSeconds: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Çalışma başlangıcı</label>\n                    <input type="time"\n                      value={form.workStartTime ?? '09:00'}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        workStartTime: event.target.value,\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Çalışma bitişi</label>\n                    <input type="time"\n                      value={form.workEndTime ?? '18:30'}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        workEndTime: event.target.value,\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field">\n                    <label>Retry sayısı</label>\n                    <input type="number" min="0" max="10"\n                      value={form.retryCount ?? 2}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        retryCount: Number(event.target.value),\n                      }))}\n                    />\n                  </div>\n                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>\n                    <label>Planlanan tarih ve saat</label>\n                    <input type="datetime-local"\n                      value={form.scheduledAt ?? ''}\n                      onChange={(event) => setForm((current) => ({\n                        ...current,\n                        scheduledAt: event.target.value || null,\n                        status: event.target.value ? 'scheduled' : current.status,\n                      }))}\n                    />\n                  </div>\n                </div>\n                <label style={{\n                  display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,\n                }}>\n                  <input\n                    type="checkbox"\n                    checked={form.typingSimulation !== false}\n                    onChange={(event) => setForm((current) => ({\n                      ...current,\n                      typingSimulation: event.target.checked,\n                    }))}\n                  />\n                  Yazıyor simülasyonu etkin\n                </label>\n              </section>\n\n              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>\n                <input\n                  type="checkbox"\n                  checked={form.onlyAllowed !== false}`,
  'gönderim ayarları bölümü',
);

write(files.campaignPage, page);

let backend = read(files.campaignBackend);

if (!backend.includes('campaign_settings')) {
  const ensureMarker = 'function ensureSchema(): void {';
  const idx = backend.indexOf(ensureMarker);
  if (idx < 0) throw new Error('Backend ensureSchema fonksiyonu bulunamadı.');

  const bodyStart = backend.indexOf('{', idx) + 1;
  backend =
    backend.slice(0, bodyStart) +
    `\n  getDatabase().exec(\`\n    CREATE TABLE IF NOT EXISTS campaign_settings (\n      campaign_id TEXT PRIMARY KEY,\n      description TEXT,\n      min_delay_seconds INTEGER NOT NULL DEFAULT 6,\n      max_delay_seconds INTEGER NOT NULL DEFAULT 14,\n      batch_size INTEGER NOT NULL DEFAULT 30,\n      batch_pause_min_seconds INTEGER NOT NULL DEFAULT 45,\n      batch_pause_max_seconds INTEGER NOT NULL DEFAULT 90,\n      daily_limit INTEGER,\n      work_start_time TEXT NOT NULL DEFAULT '09:00',\n      work_end_time TEXT NOT NULL DEFAULT '18:30',\n      typing_simulation INTEGER NOT NULL DEFAULT 1,\n      retry_count INTEGER NOT NULL DEFAULT 2,\n      scheduled_at TEXT,\n      FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE\n    );\n  \`);\n` +
    backend.slice(bodyStart);
}

const saveFunction = backend.match(/function saveCampaign\([\s\S]*?\n}\n\nfunction /);
if (!saveFunction) {
  throw new Error('saveCampaign fonksiyonu bulunamadı.');
}
if (!saveFunction[0].includes('campaign_settings')) {
  const fnText = saveFunction[0];
  const returnPos = fnText.lastIndexOf('\n  return ');
  if (returnPos < 0) throw new Error('saveCampaign return satırı bulunamadı.');
  const settingsCode = `
  const minDelaySeconds = Math.max(1, Math.min(3600, input.minDelaySeconds ?? 6));
  const maxDelaySeconds = Math.max(
    minDelaySeconds,
    Math.min(3600, input.maxDelaySeconds ?? 14),
  );
  const batchSize = Math.max(0, Math.min(10000, input.batchSize ?? 30));
  const batchPauseMinSeconds = Math.max(
    0,
    Math.min(86400, input.batchPauseMinSeconds ?? 45),
  );
  const batchPauseMaxSeconds = Math.max(
    batchPauseMinSeconds,
    Math.min(86400, input.batchPauseMaxSeconds ?? 90),
  );
  const dailyLimit =
    input.dailyLimit && input.dailyLimit > 0
      ? Math.min(100000, input.dailyLimit)
      : null;
  const retryCount = Math.max(0, Math.min(10, input.retryCount ?? 2));

  getDatabase().prepare(\`
    INSERT INTO campaign_settings (
      campaign_id, description, min_delay_seconds, max_delay_seconds,
      batch_size, batch_pause_min_seconds, batch_pause_max_seconds,
      daily_limit, work_start_time, work_end_time, typing_simulation,
      retry_count, scheduled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id) DO UPDATE SET
      description = excluded.description,
      min_delay_seconds = excluded.min_delay_seconds,
      max_delay_seconds = excluded.max_delay_seconds,
      batch_size = excluded.batch_size,
      batch_pause_min_seconds = excluded.batch_pause_min_seconds,
      batch_pause_max_seconds = excluded.batch_pause_max_seconds,
      daily_limit = excluded.daily_limit,
      work_start_time = excluded.work_start_time,
      work_end_time = excluded.work_end_time,
      typing_simulation = excluded.typing_simulation,
      retry_count = excluded.retry_count,
      scheduled_at = excluded.scheduled_at
  \`).run(
    id,
    input.description?.trim() || null,
    minDelaySeconds,
    maxDelaySeconds,
    batchSize,
    batchPauseMinSeconds,
    batchPauseMaxSeconds,
    dailyLimit,
    input.workStartTime || '09:00',
    input.workEndTime || '18:30',
    input.typingSimulation === false ? 0 : 1,
    retryCount,
    input.scheduledAt || null,
  );
`;
  const newFn =
    fnText.slice(0, returnPos) +
    settingsCode +
    fnText.slice(returnPos);
  backend = backend.replace(fnText, newFn);
}

if (!backend.includes('settings: {')) {
  backend = backend.replace(
    /function mapCampaign\(row:[\s\S]*?return \{([\s\S]*?)\n  \};\n}/,
    (full, body) => {
      return `function mapCampaign(row: any): Campaign {\n  const settingsRow = getDatabase().prepare(\`\n    SELECT * FROM campaign_settings WHERE campaign_id = ?\n  \`).get(row.id) as any;\n\n  return {${body}\n    settings: {\n      description: settingsRow?.description ?? null,\n      minDelaySeconds: settingsRow?.min_delay_seconds ?? 6,\n      maxDelaySeconds: settingsRow?.max_delay_seconds ?? 14,\n      batchSize: settingsRow?.batch_size ?? 30,\n      batchPauseMinSeconds: settingsRow?.batch_pause_min_seconds ?? 45,\n      batchPauseMaxSeconds: settingsRow?.batch_pause_max_seconds ?? 90,\n      dailyLimit: settingsRow?.daily_limit ?? null,\n      workStartTime: settingsRow?.work_start_time ?? '09:00',\n      workEndTime: settingsRow?.work_end_time ?? '18:30',\n      typingSimulation: (settingsRow?.typing_simulation ?? 1) === 1,\n      retryCount: settingsRow?.retry_count ?? 2,\n      scheduledAt: settingsRow?.scheduled_at ?? null,\n    },\n  };\n}`;
    },
  );
}

write(files.campaignBackend, backend);
