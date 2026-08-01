const fs = require('fs');
const path = require('path');

const ipcFile = 'src/main/ipc/register-campaign-ipc.ts';
const backupFile =
  'src/main/ipc/register-campaign-ipc.ts.before-package-13g-12.bak';
const repositoryFile =
  'src/main/repositories/campaign.repository.ts';
const repositorySource =
  'files/src/main/repositories/campaign.repository.ts';

if (!fs.existsSync(backupFile)) {
  throw new Error(
    `13G-12 yedek dosyası bulunamadı: ${backupFile}`,
  );
}

if (!fs.existsSync(repositorySource)) {
  throw new Error(
    `Repository kaynak dosyası bulunamadı: ${repositorySource}`,
  );
}

fs.copyFileSync(backupFile, ipcFile);

let source = fs.readFileSync(ipcFile, 'utf8');

function removeBetween(
  text,
  startMarker,
  endMarker,
  label,
) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`${label} başlangıcı bulunamadı.`);
  }

  const end = text.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`${label} bitişi bulunamadı.`);
  }

  return text.slice(0, start) + text.slice(end);
}

source = source.replace(
  `import { randomUUID } from 'node:crypto';\n`,
  '',
);

source = source.replace(
  `import { getDatabase } from '../database/database.js';`,
  `import { getDatabase } from '../database/database.js';
import {
  deleteCampaign,
  listCampaigns,
  saveCampaign,
} from '../repositories/campaign.repository.js';`,
);

source = removeBetween(
  source,
  'interface CampaignRow {',
  'function buildAudienceWhere(',
  'Campaign model ve mapping bloğu',
);

source = removeBetween(
  source,
  'function listCampaigns(',
  'function getAudienceOptions()',
  'Campaign repository fonksiyonları',
);

const invalidFragments = [
  '\n,\n): CampaignSnapshot',
  'interface CampaignRow',
  'function mapCampaign',
  'function listCampaigns',
  'function saveCampaign',
  'function deleteCampaign',
];

for (const fragment of invalidFragments) {
  if (source.includes(fragment)) {
    throw new Error(
      `IPC dosyasında beklenmeyen parça kaldı: ${fragment}`,
    );
  }
}

fs.mkdirSync(
  path.dirname(repositoryFile),
  { recursive: true },
);

fs.copyFileSync(repositorySource, repositoryFile);
fs.writeFileSync(ipcFile, source, 'utf8');

console.log('13G-12-FIX-1 başarıyla uygulandı.');
