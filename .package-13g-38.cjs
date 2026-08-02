const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-runtime-sweeper.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-runtime-sweeper.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-38.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const shutdownImport = `import {
  pauseAllCampaignRuntimes,
  resetCampaignRuntimes,
  waitForCampaignRuntimesToStop,
} from './campaign/campaign-runtime-shutdown.service.js';
`;

const sweeperImport = `import {
  clearFinishedCampaignRuntimes,
} from './campaign/campaign-runtime-sweeper.service.js';
`;

if (!source.includes(shutdownImport)) {
  throw new Error(
    '13G-37 runtime shutdown import işareti bulunamadı.',
  );
}

if (!source.includes(sweeperImport)) {
  source = source.replace(
    shutdownImport,
    shutdownImport + sweeperImport,
  );
}

const oldFunction = `export function clearFinishedCampaignRuntimeStates(): void {
  for (const [campaignId, state] of runtimeStates.entries()) {
    if (state.running) {
      continue;
    }

    try {
      removeFinishedCampaignRuntimeState({
        campaignId,
        state,
        getStatus: getCampaignStatus,
        deleteState: (id) =>
          runtimeStates.delete(id),
      });
    } catch (reason: unknown) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Runtime temizliği başarısız.';

      console.error(
        \`[Campaign Queue] \${campaignId}: \${message}\`,
      );
    }
  }
}`;

const newFunction = `export function clearFinishedCampaignRuntimeStates(): void {
  clearFinishedCampaignRuntimes(
    runtimeStates,
  );
}`;

if (!source.includes(oldFunction)) {
  throw new Error(
    'clearFinishedCampaignRuntimeStates bloğu bulunamadı.',
  );
}

source = source.replace(
  oldFunction,
  newFunction,
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

console.log('13G-38 başarıyla uygulandı.');
