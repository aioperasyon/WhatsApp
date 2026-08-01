const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const repositorySource =
  'files/src/main/repositories/campaign-recipient.repository.ts';
const repositoryTarget =
  'src/main/repositories/campaign-recipient.repository.ts';

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
  `${queueFile}.before-package-13g-13.bak`,
);

if (fs.existsSync(repositoryTarget)) {
  fs.copyFileSync(
    repositoryTarget,
    `${repositoryTarget}.before-package-13g-13.bak`,
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

source = source.replace(
  `  CampaignRecipientLog,\n`,
  '',
);
source = source.replace(
  `  CampaignRecipientLogRequest,\n`,
  '',
);
source = source.replace(
  `  CampaignRecipientLogSnapshot,\n`,
  '',
);

source = removeFunction(
  source,
  'function mapRecipient(row: RecipientRow): CampaignRecipientLog',
  'mapRecipient',
);

source = removeFunction(
  source,
  'export function listCampaignRecipients(',
  'listCampaignRecipients',
);

const exportLine =
  `export { listCampaignRecipients } from '../repositories/campaign-recipient.repository.js';\n`;

if (!source.includes(exportLine)) {
  const importEndMarker =
    `import { sendCampaignMessage } from './whatsapp-connection.service.js';\n`;

  const importEnd = source.indexOf(importEndMarker);

  if (importEnd === -1) {
    throw new Error(
      'WhatsApp servis import işareti bulunamadı.',
    );
  }

  const insertionPoint =
    importEnd + importEndMarker.length;

  source =
    source.slice(0, insertionPoint) +
    exportLine +
    source.slice(insertionPoint);
}

const forbidden = [
  'CampaignRecipientLogRequest',
  'CampaignRecipientLogSnapshot',
  'function mapRecipient',
  'export function listCampaignRecipients(',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken kod kaldı: ${marker}`,
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

console.log('13G-13 başarıyla uygulandı.');
