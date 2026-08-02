const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-scheduler-dependencies.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-scheduler-dependencies.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-41.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const lifecycleImport = `import {
  cancelCampaignLifecycle,
  pauseCampaignLifecycle,
  resumeCampaignLifecycle,
  startCampaignLifecycle,
} from './campaign/campaign-lifecycle.service.js';
`;

const dependencyImport = `import {
  createCampaignSchedulerDependencies,
} from './campaign/campaign-scheduler-dependencies.service.js';
`;

if (!source.includes(lifecycleImport)) {
  throw new Error(
    '13G-40 lifecycle import işareti bulunamadı.',
  );
}

if (!source.includes(dependencyImport)) {
  source = source.replace(
    lifecycleImport,
    lifecycleImport + dependencyImport,
  );
}

const oldFunction = `function getCampaignSchedulerDependencies() {
  return {
    isShuttingDown: () =>
      campaignEngineShuttingDown,
    startCampaign,
    clearFinishedRuntimeStates:
      clearFinishedCampaignRuntimeStates,
  };
}`;

const newFunction = `function getCampaignSchedulerDependencies() {
  return createCampaignSchedulerDependencies({
    isShuttingDown: () =>
      campaignEngineShuttingDown,
    startCampaign,
    clearFinishedRuntimeStates:
      clearFinishedCampaignRuntimeStates,
  });
}`;

if (!source.includes(oldFunction)) {
  throw new Error(
    'getCampaignSchedulerDependencies fonksiyonu bulunamadı.',
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

console.log('13G-41 başarıyla uygulandı.');
