
const fs = require('fs');

const file = 'src/main/ipc/register-campaign-ipc.ts';

if (!fs.existsSync(file)) {
  throw new Error(`Dosya bulunamadi: ${file}`);
}

fs.copyFileSync(
  file,
  `${file}.before-package-13e-5.bak`,
);

let source = fs.readFileSync(file, 'utf8');

const anchor = `    CREATE INDEX IF NOT EXISTS idx_campaign_settings_campaign
      ON campaign_settings (campaign_id);
`;

const addition = `    CREATE INDEX IF NOT EXISTS idx_campaign_settings_campaign
      ON campaign_settings (campaign_id);

    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_active_queue
      ON campaign_recipients (campaign_id, id)
      WHERE status IN ('pending', 'sending');

    CREATE INDEX IF NOT EXISTS idx_campaigns_active_status
      ON campaigns (status, updated_at)
      WHERE status IN ('running', 'paused', 'scheduled');
`;

if (
  source.includes('idx_campaign_recipients_active_queue') &&
  source.includes('idx_campaigns_active_status')
) {
  console.log('Paket 13E-5 daha once uygulanmis.');
} else {
  if (!source.includes(anchor)) {
    throw new Error(
      'Performans indeksleri icindeki campaign_settings indeksi bulunamadi.',
    );
  }

  source = source.replace(anchor, addition);
  fs.writeFileSync(file, source, 'utf8');

  console.log(`Guncellendi: ${file}`);
}

console.log('Aktif kuyruk ve aktif kampanya partial indeksleri eklendi.');
