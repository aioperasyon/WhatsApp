const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const timingSource =
  'files/src/main/services/campaign/campaign-timing.service.ts';
const timingTarget =
  'src/main/services/campaign/campaign-timing.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(timingSource)) {
  throw new Error(
    `Timing servis kaynağı bulunamadı: ${timingSource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-17.bak`,
);

if (fs.existsSync(timingTarget)) {
  fs.copyFileSync(
    timingTarget,
    `${timingTarget}.before-package-13g-17.bak`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const whatsappImport =
  `import { sendCampaignMessage } from './whatsapp-connection.service.js';\n`;

const timingImport = `import {
  millisecondsUntilCampaignWorkingWindow,
  millisecondsUntilNextCampaignDay,
  randomCampaignInteger,
} from './campaign/campaign-timing.service.js';
`;

if (!source.includes(whatsappImport)) {
  throw new Error(
    'WhatsApp servis import işareti bulunamadı.',
  );
}

if (!source.includes(timingImport)) {
  source = source.replace(
    whatsappImport,
    timingImport + whatsappImport,
  );
}

const randomStart =
  source.indexOf(
    'function randomInteger(minimum: number, maximum: number): number',
  );
const waitStart =
  source.indexOf(
    'async function waitInterruptibly(',
    randomStart,
  );

if (
  randomStart === -1 ||
  waitStart === -1
) {
  throw new Error(
    'randomInteger fonksiyon bloğu bulunamadı.',
  );
}

source =
  source.slice(0, randomStart) +
  source.slice(waitStart);

const parsedTimeStart =
  source.indexOf(
    'interface ParsedCampaignTime {',
  );
const runtimeCleanupStart =
  source.indexOf(
    'function removeFinishedRuntimeState(',
    parsedTimeStart,
  );

if (
  parsedTimeStart === -1 ||
  runtimeCleanupStart === -1
) {
  throw new Error(
    'Campaign timing fonksiyon bloğu bulunamadı.',
  );
}

source =
  source.slice(0, parsedTimeStart) +
  source.slice(runtimeCleanupStart);

source = source.replaceAll(
  'millisecondsUntilWorkingWindow(',
  'millisecondsUntilCampaignWorkingWindow(',
);

source = source.replaceAll(
  'millisecondsUntilNextLocalDay(',
  'millisecondsUntilNextCampaignDay(',
);

source = source.replaceAll(
  'randomInteger(',
  'randomCampaignInteger(',
);

const forbidden = [
  'interface ParsedCampaignTime',
  'function parseTime(',
  'function resolveWorkingTime(',
  'function millisecondsUntilWorkingWindow(',
  'function millisecondsUntilNextLocalDay(',
  'function randomInteger(',
  'DEFAULT_WORK_START_TIME',
  'invalidWorkingWindowWarnings',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

fs.mkdirSync(
  path.dirname(timingTarget),
  { recursive: true },
);

fs.copyFileSync(
  timingSource,
  timingTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-17 başarıyla uygulandı.');
