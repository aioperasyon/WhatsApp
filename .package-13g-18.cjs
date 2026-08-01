const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const runtimeSource =
  'files/src/main/services/campaign/campaign-runtime-wait.service.ts';
const runtimeTarget =
  'src/main/services/campaign/campaign-runtime-wait.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(runtimeSource)) {
  throw new Error(
    `Runtime servis kaynağı bulunamadı: ${runtimeSource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-18.bak`,
);

if (fs.existsSync(runtimeTarget)) {
  fs.copyFileSync(
    runtimeTarget,
    `${runtimeTarget}.before-package-13g-18.bak`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const timingImport = `import {
  millisecondsUntilCampaignWorkingWindow,
  millisecondsUntilNextCampaignDay,
  randomCampaignInteger,
} from './campaign/campaign-timing.service.js';
`;

const runtimeImport = `import {
  waitForCampaignRuntime,
  wakeCampaignRuntime,
} from './campaign/campaign-runtime-wait.service.js';
`;

if (!source.includes(timingImport)) {
  throw new Error(
    '13G-17 timing import işareti bulunamadı. Önce 13G-17 uygulanmalıdır.',
  );
}

if (!source.includes(runtimeImport)) {
  source = source.replace(
    timingImport,
    timingImport + runtimeImport,
  );
}

const waitStart =
  source.indexOf(
    'async function waitInterruptibly(',
  );

const runtimeInterfaceStart =
  source.indexOf(
    'interface RuntimeState {',
  );

if (
  waitStart === -1 ||
  runtimeInterfaceStart === -1
) {
  throw new Error(
    'Runtime wait fonksiyonları veya RuntimeState bulunamadı.',
  );
}

const runtimeCleanupStart =
  source.indexOf(
    'function removeFinishedRuntimeState(',
    waitStart,
  );

if (runtimeCleanupStart === -1) {
  throw new Error(
    'removeFinishedRuntimeState işareti bulunamadı.',
  );
}

source =
  source.slice(0, waitStart) +
  source.slice(runtimeCleanupStart);

source = source.replaceAll(
  'waitInterruptibly(',
  'waitForCampaignRuntime(',
);

source = source.replaceAll(
  'wakeRuntimeWait(',
  'wakeCampaignRuntime(',
);

const forbidden = [
  'async function waitInterruptibly(',
  'function wakeRuntimeWait(',
  'waitInterruptibly(',
  'wakeRuntimeWait(',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

const waitUsageCount =
  (source.match(/waitForCampaignRuntime\(/g) ?? []).length;

const wakeUsageCount =
  (source.match(/wakeCampaignRuntime\(/g) ?? []).length;

if (waitUsageCount < 4) {
  throw new Error(
    `waitForCampaignRuntime kullanım sayısı beklenenden az: ${waitUsageCount}`,
  );
}

if (wakeUsageCount < 3) {
  throw new Error(
    `wakeCampaignRuntime kullanım sayısı beklenenden az: ${wakeUsageCount}`,
  );
}

fs.mkdirSync(
  path.dirname(runtimeTarget),
  { recursive: true },
);

fs.copyFileSync(
  runtimeSource,
  runtimeTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-18 başarıyla uygulandı.');
