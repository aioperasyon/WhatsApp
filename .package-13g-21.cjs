const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const recoverySource =
  'files/src/main/services/campaign/campaign-recovery.service.ts';
const recoveryTarget =
  'src/main/services/campaign/campaign-recovery.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(recoverySource)) {
  throw new Error(
    `Recovery servis kaynağı bulunamadı: ${recoverySource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-21.bak`,
);

if (fs.existsSync(recoveryTarget)) {
  fs.copyFileSync(
    recoveryTarget,
    `${recoveryTarget}.before-package-13g-21.bak`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const schedulerImport = `import {
  processScheduledCampaigns as processScheduledCampaignsService,
  restartCampaignScheduler as restartCampaignSchedulerService,
  startCampaignScheduler as startCampaignSchedulerService,
  stopCampaignScheduler as stopCampaignSchedulerService,
} from './campaign/campaign-scheduler.service.js';
`;

const recoveryImport = `import {
  recoverInterruptedCampaigns as recoverInterruptedCampaignsService,
} from './campaign/campaign-recovery.service.js';
`;

if (!source.includes(schedulerImport)) {
  throw new Error(
    '13G-20 scheduler import işareti bulunamadı. Önce 13G-20-FIX-1 uygulanmalıdır.',
  );
}

if (!source.includes(recoveryImport)) {
  source = source.replace(
    schedulerImport,
    schedulerImport + recoveryImport,
  );
}

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

  const end = text.indexOf(
    endMarker,
    start,
  );

  if (end === -1) {
    throw new Error(`${label} bitişi bulunamadı.`);
  }

  return text.slice(0, start) + text.slice(end);
}

source = removeBetween(
  source,
  'function recoverInterruptedRecipientRows(): void',
  'export async function shutdownCampaignEngine(',
  'recovery yardımcı fonksiyonları',
);

const recoverStart =
  source.indexOf(
    'export function recoverInterruptedCampaigns(): void',
  );

if (recoverStart === -1) {
  throw new Error(
    'recoverInterruptedCampaigns fonksiyonu bulunamadı.',
  );
}

const recoverBraceStart =
  source.indexOf('{', recoverStart);

if (recoverBraceStart === -1) {
  throw new Error(
    'recoverInterruptedCampaigns açılış parantezi bulunamadı.',
  );
}

let depth = 0;
let quote = null;
let escaped = false;
let recoverEnd = -1;

for (
  let index = recoverBraceStart;
  index < source.length;
  index += 1
) {
  const char = source[index];

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

  if (char === '{') {
    depth += 1;
  } else if (char === '}') {
    depth -= 1;

    if (depth === 0) {
      recoverEnd = index + 1;
      break;
    }
  }
}

if (recoverEnd === -1) {
  throw new Error(
    'recoverInterruptedCampaigns kapanış parantezi bulunamadı.',
  );
}

while (
  recoverEnd < source.length &&
  (
    source[recoverEnd] === '\r' ||
    source[recoverEnd] === '\n'
  )
) {
  recoverEnd += 1;
}

const wrapper = `export function recoverInterruptedCampaigns(): void {
  recoverInterruptedCampaignsService();
}
`;

source =
  source.slice(0, recoverStart) +
  wrapper +
  source.slice(recoverEnd);

const forbidden = [
  'function recoverInterruptedRecipientRows',
  'function recoverInterruptedCampaignStatuses',
  'Uygulama kapanışı nedeniyle gönderim yeniden kuyruğa alındı.',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

const wrapperCount =
  (source.match(/export function recoverInterruptedCampaigns\(\): void/g) ?? []).length;

if (wrapperCount !== 1) {
  throw new Error(
    `Beklenen recovery wrapper sayısı 1, bulunan: ${wrapperCount}`,
  );
}

fs.mkdirSync(
  path.dirname(recoveryTarget),
  { recursive: true },
);

fs.copyFileSync(
  recoverySource,
  recoveryTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-21 başarıyla uygulandı.');
