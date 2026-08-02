const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-runtime-shutdown.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-runtime-shutdown.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-37.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const runnerImport = `import {
  runCampaignQueue,
} from './campaign/campaign-queue-runner.service.js';
`;

const shutdownImport = `import {
  pauseAllCampaignRuntimes,
  resetCampaignRuntimes,
  waitForCampaignRuntimesToStop,
} from './campaign/campaign-runtime-shutdown.service.js';
`;

if (!source.includes(runnerImport)) {
  throw new Error(
    '13G-36 queue runner import işareti bulunamadı.',
  );
}

if (!source.includes(shutdownImport)) {
  source = source.replace(
    runnerImport,
    runnerImport + shutdownImport,
  );
}

const oldBlock = `  for (const state of runtimeStates.values()) {
    state.paused = true;
    wakeCampaignRuntime(state);
  }

  const deadline = Date.now() + Math.max(1000, timeoutMs);

  while (
    Array.from(runtimeStates.values()).some(
      (state) => state.running,
    ) &&
    Date.now() < deadline
  ) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  const stillRunning = Array.from(runtimeStates.entries())
    .filter(([, state]) => state.running)
    .map(([campaignId]) => campaignId);`;

const newBlock = `  pauseAllCampaignRuntimes(
    runtimeStates,
  );

  const stillRunning =
    await waitForCampaignRuntimesToStop({
      runtimeStates,
      timeoutMs,
    });`;

if (!source.includes(oldBlock)) {
  throw new Error(
    'Shutdown runtime bekleme bloğu bulunamadı.',
  );
}

source = source.replace(
  oldBlock,
  newBlock,
);

const oldReset = `  for (const state of runtimeStates.values()) {
    state.running = false;
    state.wakeWait = undefined;
  }

  runtimeStates.clear();`;

const newReset = `  resetCampaignRuntimes(
    runtimeStates,
  );`;

if (!source.includes(oldReset)) {
  throw new Error(
    'Shutdown runtime reset bloğu bulunamadı.',
  );
}

source = source.replace(
  oldReset,
  newReset,
);

fs.mkdirSync(
  path.dirname(serviceTarget),
  { recursive: true },
);

fs.copyFileSync(
  serviceSource,
  serviceTarget,
);

fs.writeFileSync(
  queueFile,
  source,
  'utf8',
);

console.log('13G-37 başarıyla uygulandı.');
