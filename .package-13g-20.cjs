const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const schedulerSource =
  'files/src/main/services/campaign/campaign-scheduler.service.ts';
const schedulerTarget =
  'src/main/services/campaign/campaign-scheduler.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(schedulerSource)) {
  throw new Error(
    `Scheduler servis kaynağı bulunamadı: ${schedulerSource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-20.bak`,
);

if (fs.existsSync(schedulerTarget)) {
  fs.copyFileSync(
    schedulerTarget,
    `${schedulerTarget}.before-package-13g-20.bak`,
  );
}

let source = fs.readFileSync(queueFile, 'utf8');

const runtimeImport = `import {
  waitForCampaignRuntime,
  wakeCampaignRuntime,
} from './campaign/campaign-runtime-wait.service.js';
`;

const schedulerImport = `import {
  processScheduledCampaigns as processScheduledCampaignsService,
  restartCampaignScheduler as restartCampaignSchedulerService,
  startCampaignScheduler as startCampaignSchedulerService,
  stopCampaignScheduler as stopCampaignSchedulerService,
} from './campaign/campaign-scheduler.service.js';
`;

if (!source.includes(runtimeImport)) {
  throw new Error(
    'Runtime wait servis import işareti bulunamadı.',
  );
}

if (!source.includes(schedulerImport)) {
  source = source.replace(
    runtimeImport,
    runtimeImport + schedulerImport,
  );
}

source = source.replace(
  `const SCHEDULER_INTERVAL_MS = 30000;

let campaignSchedulerTimer: NodeJS.Timeout | null = null;
let campaignSchedulerRunning = false;
let campaignSchedulerGeneration = 0;
let campaignEngineShuttingDown = false;

const scheduledCampaignClaims = new Set<string>();`,
  `let campaignEngineShuttingDown = false;`,
);

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
  'interface ScheduledCampaignRow {',
  'export function clearFinishedCampaignRuntimeStates(): void',
  'scheduler ana bloğu',
);

source = removeBetween(
  source,
  'export function restartCampaignScheduler(): void',
  'function recoverInterruptedRecipientRows(): void',
  'restartCampaignScheduler',
);

const wrapperCode = `function getCampaignSchedulerDependencies() {
  return {
    isShuttingDown: () =>
      campaignEngineShuttingDown,
    startCampaign,
    clearFinishedRuntimeStates:
      clearFinishedCampaignRuntimeStates,
  };
}

export async function processScheduledCampaigns(): Promise<void> {
  await processScheduledCampaignsService(
    getCampaignSchedulerDependencies(),
  );
}

export function startCampaignScheduler(): void {
  startCampaignSchedulerService(
    getCampaignSchedulerDependencies(),
  );
}

export function stopCampaignScheduler(): void {
  stopCampaignSchedulerService(
    clearFinishedCampaignRuntimeStates,
  );
}

export function restartCampaignScheduler(): void {
  restartCampaignSchedulerService(
    getCampaignSchedulerDependencies(),
  );
}

`;

const clearMarker =
  'export function clearFinishedCampaignRuntimeStates(): void';

const clearIndex = source.indexOf(clearMarker);

if (clearIndex === -1) {
  throw new Error(
    'clearFinishedCampaignRuntimeStates işareti bulunamadı.',
  );
}

source =
  source.slice(0, clearIndex) +
  wrapperCode +
  source.slice(clearIndex);

const forbidden = [
  'interface ScheduledCampaignRow',
  'campaignSchedulerTimer',
  'campaignSchedulerRunning',
  'campaignSchedulerGeneration',
  'scheduledCampaignClaims',
  'SCHEDULER_INTERVAL_MS',
  'async function runCampaignSchedulerTick(',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

fs.mkdirSync(
  path.dirname(schedulerTarget),
  { recursive: true },
);

fs.copyFileSync(
  schedulerSource,
  schedulerTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-20 başarıyla uygulandı.');
