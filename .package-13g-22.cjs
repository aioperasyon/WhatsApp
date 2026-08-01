const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-shutdown-persistence.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-shutdown-persistence.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(
    `Shutdown persistence servis kaynağı bulunamadı: ${serviceSource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-22.bak`,
);

if (fs.existsSync(serviceTarget)) {
  fs.copyFileSync(
    serviceTarget,
    `${serviceTarget}.before-package-13g-22.bak`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const recoveryImport = `import {
  recoverInterruptedCampaigns as recoverInterruptedCampaignsService,
} from './campaign/campaign-recovery.service.js';
`;

const shutdownImport = `import {
  persistCampaignShutdownState,
} from './campaign/campaign-shutdown-persistence.service.js';
`;

if (!source.includes(recoveryImport)) {
  throw new Error(
    '13G-21 recovery import işareti bulunamadı. Önce 13G-21 uygulanmalıdır.',
  );
}

if (!source.includes(shutdownImport)) {
  source = source.replace(
    recoveryImport,
    recoveryImport + shutdownImport,
  );
}

const oldBlock = `  const database = getDatabase();
  const now = new Date().toISOString();

  const persistShutdownState = database.transaction(() => {
    database.prepare(\`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = CASE
          WHEN error_message IS NULL OR TRIM(error_message) = ''
            THEN 'Uygulama kontrollü kapandığı için gönderim yeniden kuyruğa alındı.'
          ELSE error_message
        END,
        updated_at = ?
      WHERE status = 'sending'
    \`).run(now);

    database.prepare(\`
      UPDATE campaigns
      SET
        status = 'paused',
        updated_at = ?
      WHERE status = 'running'
    \`).run(now);
  });

  persistShutdownState();`;

const newBlock = `  persistCampaignShutdownState();`;

const count = source.split(oldBlock).length - 1;

if (count !== 1) {
  throw new Error(
    `Shutdown persistence bloğu için beklenen eşleşme sayısı 1, bulunan: ${count}`,
  );
}

source = source.replace(
  oldBlock,
  newBlock,
);

const forbidden = [
  'Uygulama kontrollü kapandığı için gönderim yeniden kuyruğa alındı.',
  'const persistShutdownState = database.transaction',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

const callCount =
  (source.match(/persistCampaignShutdownState\(\);/g) ?? []).length;

if (callCount !== 1) {
  throw new Error(
    `Beklenen persistCampaignShutdownState çağrısı 1, bulunan: ${callCount}`,
  );
}

fs.mkdirSync(
  path.dirname(serviceTarget),
  { recursive: true },
);

fs.copyFileSync(
  serviceSource,
  serviceTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-22 başarıyla uygulandı.');
