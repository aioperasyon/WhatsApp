const fs = require('fs');
const path = require('path');
const ipcFile = 'src/main/ipc/register-campaign-ipc.ts';
const repositoryFile = 'src/main/repositories/campaign.repository.ts';
if (!fs.existsSync(ipcFile)) throw new Error(`Dosya bulunamadı: ${ipcFile}`);
fs.copyFileSync(ipcFile, `${ipcFile}.before-package-13g-12.bak`);

function removeBlock(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`${label} bloğu bulunamadı.`);
  return source.slice(0, start) + source.slice(end);
}

function removeFunction(source, signature, label) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`${label} başlangıcı bulunamadı.`);
  const braceStart = source.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let i = braceStart; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (c === '\\') escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '/' && n === '/') { const e = source.indexOf('\n', i + 2); i = e === -1 ? source.length : e; continue; }
    if (c === '/' && n === '*') { const e = source.indexOf('*/', i + 2); if (e === -1) throw new Error(`${label} yorum hatası.`); i = e + 1; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < source.length && (source[end] === '\r' || source[end] === '\n')) end += 1;
        return source.slice(0, start) + source.slice(end);
      }
    }
  }
  throw new Error(`${label} kapanışı bulunamadı.`);
}

let source = fs.readFileSync(ipcFile, 'utf8');
source = source.replace("import { randomUUID } from 'node:crypto';\n", '');
source = source.replace(
  "import { getDatabase } from '../database/database.js';",
  "import { getDatabase } from '../database/database.js';\nimport {\n  deleteCampaign,\n  listCampaigns,\n  saveCampaign,\n} from '../repositories/campaign.repository.js';",
);
source = removeBlock(source, 'interface CampaignRow {', 'function normalizeValues', 'CampaignRow');
source = removeFunction(source, 'function parseValues(value: string): string[]', 'parseValues');
source = removeFunction(source, 'function mapCampaign(row: CampaignRow): Campaign', 'mapCampaign');
source = removeFunction(source, 'function listCampaigns(', 'listCampaigns');
source = removeFunction(source, 'function saveCampaign(', 'saveCampaign');
source = removeFunction(source, 'function deleteCampaign(', 'deleteCampaign');

for (const marker of ['interface CampaignRow', 'function mapCampaign', 'function listCampaigns', 'function saveCampaign', 'function deleteCampaign']) {
  if (source.includes(marker)) throw new Error(`IPC dosyasında taşınmamış kod kaldı: ${marker}`);
}

fs.mkdirSync(path.dirname(repositoryFile), { recursive: true });
fs.writeFileSync(ipcFile, source, 'utf8');
console.log('13G-12 IPC refaktörü uygulandı.');
