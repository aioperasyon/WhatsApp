const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const repositorySource =
  'files/src/main/repositories/campaign-recipient-queue.repository.ts';
const repositoryTarget =
  'src/main/repositories/campaign-recipient-queue.repository.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(repositorySource)) {
  throw new Error(
    `Repository kaynak dosyası bulunamadı: ${repositorySource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-14.bak`,
);

if (fs.existsSync(repositoryTarget)) {
  fs.copyFileSync(
    repositoryTarget,
    `${repositoryTarget}.before-package-13g-14.bak`,
  );
}

function removeFunction(source, signature, label) {
  const start = source.indexOf(signature);

  if (start === -1) {
    throw new Error(`${label} başlangıcı bulunamadı.`);
  }

  const braceStart = source.indexOf('{', start);

  if (braceStart === -1) {
    throw new Error(
      `${label} açılış süslü parantezi bulunamadı.`,
    );
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (
    let index = braceStart;
    index < source.length;
    index += 1
  ) {
    const char = source[index];
    const next = source[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quote) {
      if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (
      char === "'" ||
      char === '"' ||
      char === '`'
    ) {
      quote = char;
      continue;
    }

    if (char === '/' && next === '/') {
      const lineEnd = source.indexOf('\n', index + 2);
      index =
        lineEnd === -1
          ? source.length
          : lineEnd;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = source.indexOf(
        '*/',
        index + 2,
      );

      if (commentEnd === -1) {
        throw new Error(
          `${label} içinde kapanmayan yorum bulundu.`,
        );
      }

      index = commentEnd + 1;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        let end = index + 1;

        while (
          end < source.length &&
          (
            source[end] === '\r' ||
            source[end] === '\n'
          )
        ) {
          end += 1;
        }

        return (
          source.slice(0, start) +
          source.slice(end)
        );
      }
    }
  }

  throw new Error(
    `${label} kapanış süslü parantezi bulunamadı.`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const importMarker =
  `import { getDatabase } from '../database/database.js';\n`;

if (!source.includes(importMarker)) {
  throw new Error(
    'Veritabanı import işareti bulunamadı.',
  );
}

const repositoryImport = `import {
  countCampaignRecipientsSentToday,
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';
`;

if (!source.includes(repositoryImport)) {
  source = source.replace(
    importMarker,
    importMarker + repositoryImport,
  );
}

source = removeFunction(
  source,
  'function countSentToday(campaignId: string): number',
  'countSentToday',
);

source = removeFunction(
  source,
  'function buildAudienceQuery(campaign: Campaign):',
  'buildAudienceQuery',
);

source = removeFunction(
  source,
  'function seedRecipients(campaign: Campaign): void',
  'seedRecipients',
);

source = removeFunction(
  source,
  'function refreshCounts(campaignId: string): void',
  'refreshCounts',
);

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

console.log('13G-14 başarıyla uygulandı.');
