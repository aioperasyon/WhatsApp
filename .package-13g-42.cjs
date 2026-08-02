const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-lifecycle-dependencies.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-lifecycle-dependencies.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-42.bak`,
);

let source = fs.readFileSync(
  queueFile,
  'utf8',
);

const schedulerDependencyImport = `import {
  createCampaignSchedulerDependencies,
} from './campaign/campaign-scheduler-dependencies.service.js';
`;

const lifecycleDependencyImport = `import {
  createCampaignLifecycleDependencies,
} from './campaign/campaign-lifecycle-dependencies.service.js';
`;

if (!source.includes(
  schedulerDependencyImport,
)) {
  throw new Error(
    '13G-41 scheduler dependencies import işareti bulunamadı.',
  );
}

if (!source.includes(
  lifecycleDependencyImport,
)) {
  source = source.replace(
    schedulerDependencyImport,
    schedulerDependencyImport +
      lifecycleDependencyImport,
  );
}

const oldFunction = `function getCampaignLifecycleDependencies() {
  return {
    runtimeStates,
    isShuttingDown: () => campaignEngineShuttingDown,
    runQueue,
  };
}`;

const newFunction = `function getCampaignLifecycleDependencies() {
  return createCampaignLifecycleDependencies({
    runtimeStates,
    isShuttingDown: () =>
      campaignEngineShuttingDown,
    runQueue,
  });
}`;

if (!source.includes(oldFunction)) {
  throw new Error(
    'getCampaignLifecycleDependencies fonksiyonu bulunamadı.',
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

console.log(
  '13G-42 başarıyla uygulandı.',
);
