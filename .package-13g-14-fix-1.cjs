const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const backupFile =
  'src/main/services/campaign-queue.service.ts.before-package-13g-14.bak';
const repositorySource =
  'files/src/main/repositories/campaign-recipient-queue.repository.ts';
const repositoryTarget =
  'src/main/repositories/campaign-recipient-queue.repository.ts';

if (!fs.existsSync(backupFile)) {
  throw new Error(
    `13G-14 yedek dosyası bulunamadı: ${backupFile}`,
  );
}

if (!fs.existsSync(repositorySource)) {
  throw new Error(
    `Repository kaynak dosyası bulunamadı: ${repositorySource}`,
  );
}

fs.copyFileSync(backupFile, queueFile);

let source = fs.readFileSync(queueFile, 'utf8');

const importMarker =
  `import { getDatabase } from '../database/database.js';\n`;

const repositoryImport = `import {
  countCampaignRecipientsSentToday,
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';
`;

if (!source.includes(importMarker)) {
  throw new Error(
    'Veritabanı import işareti bulunamadı.',
  );
}

if (!source.includes(repositoryImport)) {
  source = source.replace(
    importMarker,
    importMarker + repositoryImport,
  );
}

const blockStart =
  source.indexOf(
    'function countSentToday(campaignId: string): number',
  );

const blockEnd =
  source.indexOf(
    'function removeFinishedRuntimeState(',
    blockStart,
  );

if (blockStart === -1) {
  throw new Error(
    'countSentToday başlangıcı bulunamadı.',
  );
}

if (blockEnd === -1) {
  throw new Error(
    'removeFinishedRuntimeState işareti bulunamadı.',
  );
}

source =
  source.slice(0, blockStart) +
  source.slice(blockEnd);

source = source.replaceAll(
  'countSentToday(',
  'countCampaignRecipientsSentToday(',
);

source = source.replaceAll(
  'seedRecipients(',
  'seedCampaignRecipients(',
);

source = source.replaceAll(
  'refreshCounts(',
  'refreshCampaignRecipientCounts(',
);

const forbidden = [
  'function countSentToday(',
  'function buildAudienceQuery(',
  'function seedRecipients(',
  'function refreshCounts(',
  'countSentToday(',
  'seedRecipients(',
  'refreshCounts(',
  'if (campaign.onlyAllowed)',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

fs.mkdirSync(
  path.dirname(repositoryTarget),
  { recursive: true },
);

fs.copyFileSync(
  repositorySource,
  repositoryTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-14-FIX-1 başarıyla uygulandı.');
