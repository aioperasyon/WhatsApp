const fs = require('fs');

const queueFile =
  'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-16.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const databaseImport =
  `import { getDatabase } from '../database/database.js';\n`;

const campaignRepositoryImport = `import {
  getCampaignById,
} from '../repositories/campaign.repository.js';
`;

if (!source.includes(databaseImport)) {
  throw new Error(
    'Veritabanı import işareti bulunamadı.',
  );
}

if (!source.includes(campaignRepositoryImport)) {
  source = source.replace(
    databaseImport,
    databaseImport + campaignRepositoryImport,
  );
}

const campaignRowStart =
  source.indexOf('interface CampaignRow {');
const runtimeStateStart =
  source.indexOf(
    'interface RuntimeState {',
    campaignRowStart,
  );

if (
  campaignRowStart === -1 ||
  runtimeStateStart === -1
) {
  throw new Error(
    'CampaignRow bloğu bulunamadı.',
  );
}

source =
  source.slice(0, campaignRowStart) +
  source.slice(runtimeStateStart);

const parseStart =
  source.indexOf(
    'function parseValues(value: string): string[]',
  );
const claimStart =
  source.indexOf(
    'function claimCampaignStart(',
    parseStart,
  );

if (
  parseStart === -1 ||
  claimStart === -1
) {
  throw new Error(
    'Kampanya mapping bloğu bulunamadı.',
  );
}

const readCampaignWrapper = `function readCampaign(
  campaignId: string,
): Campaign {
  const campaign = getCampaignById(campaignId);

  if (!campaign) {
    throw new Error('Kampanya bulunamadı.');
  }

  return campaign;
}

`;

source =
  source.slice(0, parseStart) +
  readCampaignWrapper +
  source.slice(claimStart);

source = source.replace(
  `  CampaignStatus,\n`,
  `  CampaignStatus,\n`,
);

const forbidden = [
  'interface CampaignRow',
  'function parseValues(',
  'function mapCampaign(',
  'account_name:',
  'sectors_json:',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

const readCampaignCount =
  (source.match(/function readCampaign\(/g) ?? []).length;

if (readCampaignCount !== 1) {
  throw new Error(
    `Beklenen readCampaign fonksiyon sayısı 1, bulunan: ${readCampaignCount}`,
  );
}

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-16 başarıyla uygulandı.');
