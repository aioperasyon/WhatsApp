const fs = require('fs');
const path = require('path');

const queueFile = 'src/main/services/campaign-queue.service.ts';
const repositorySource = 'files/src/main/repositories/campaign-state.repository.ts';
const repositoryTarget = 'src/main/repositories/campaign-state.repository.ts';

if (!fs.existsSync(queueFile)) throw new Error(`Dosya bulunamadı: ${queueFile}`);
if (!fs.existsSync(repositorySource)) throw new Error(`Repository kaynak dosyası bulunamadı: ${repositorySource}`);

fs.copyFileSync(queueFile, `${queueFile}.before-package-13g-19-v2.bak`);
if (fs.existsSync(repositoryTarget)) {
  fs.copyFileSync(repositoryTarget, `${repositoryTarget}.before-package-13g-19-v2.bak`);
}

let source = fs.readFileSync(queueFile, 'utf8');
const dbImport = `import { getDatabase } from '../database/database.js';\n`;
const stateImport = `import {\n  claimCampaignStart,\n  completeCampaign,\n  getCampaignStatus,\n  reconcileCampaignState,\n} from '../repositories/campaign-state.repository.js';\n`;

if (!source.includes(dbImport)) throw new Error('Veritabanı import işareti bulunamadı.');
if (!source.includes(stateImport)) source = source.replace(dbImport, dbImport + stateImport);

function removeBetween(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`${label} başlangıcı bulunamadı.`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`${label} bitişi bulunamadı.`);
  return text.slice(0, start) + text.slice(end);
}

source = removeBetween(source, 'function claimCampaignStart(', 'async function waitForCampaignRuntime(', 'claimCampaignStart');
source = removeBetween(source, 'function reconcileCampaignState(', 'async function runQueue(', 'reconcileCampaignState');

const oldRuntimeLookup = `  const row = getDatabase()\n    .prepare(\`\n      SELECT status\n      FROM campaigns\n      WHERE id = ?\n      LIMIT 1\n    \`)\n    .get(campaignId) as\n    | { status: string }\n    | undefined;\n\n  if (\n    !row ||\n    row.status === 'completed' ||\n    row.status === 'cancelled' ||\n    row.status === 'failed'\n  ) {`;
const newRuntimeLookup = `  const status =\n    getCampaignStatus(campaignId);\n\n  if (\n    status === null ||\n    status === 'completed' ||\n    status === 'cancelled' ||\n    status === 'failed'\n  ) {`;
if (!source.includes(oldRuntimeLookup)) throw new Error('Runtime status sorgusu bulunamadı.');
source = source.replace(oldRuntimeLookup, newRuntimeLookup);

const oldCompleteBlock = `        const now = new Date().toISOString();\n        getDatabase().prepare(\`\n          UPDATE campaigns\n          SET status = 'completed', completed_at = ?, updated_at = ?\n          WHERE id = ?\n        \`).run(now, now, campaignId);`;
if (!source.includes(oldCompleteBlock)) throw new Error('Kampanya tamamlama sorgusu bulunamadı.');
source = source.replace(oldCompleteBlock, `        completeCampaign(campaignId);`);

const forbidden = [
  'function claimCampaignStart(',
  'function reconcileCampaignState(',
  'SELECT status\n      FROM campaigns',
  "SET status = 'completed', completed_at",
];
for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Queue dosyasında taşınması gereken parça kaldı: ${marker}`);
}

fs.mkdirSync(path.dirname(repositoryTarget), { recursive: true });
fs.copyFileSync(repositorySource, repositoryTarget);
fs.writeFileSync(queueFile, source, 'utf8');
console.log('13G-19 V2 başarıyla uygulandı.');
