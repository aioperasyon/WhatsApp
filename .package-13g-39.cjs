const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-engine-shutdown.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-engine-shutdown.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-39.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const sweeperImport = `import {
  clearFinishedCampaignRuntimes,
} from './campaign/campaign-runtime-sweeper.service.js';
`;

const shutdownEngineImport = `import {
  shutdownCampaignRuntimeEngine,
} from './campaign/campaign-engine-shutdown.service.js';
`;

if (!source.includes(sweeperImport)) {
  throw new Error(
    '13G-38 runtime sweeper import işareti bulunamadı.',
  );
}

if (!source.includes(shutdownEngineImport)) {
  source = source.replace(
    sweeperImport,
    sweeperImport + shutdownEngineImport,
  );
}

source = source.replace(
`import {
  persistCampaignShutdownState,
} from './campaign/campaign-shutdown-persistence.service.js';
`,
'',
);

source = source.replace(
`import {
  pauseAllCampaignRuntimes,
  resetCampaignRuntimes,
  waitForCampaignRuntimesToStop,
} from './campaign/campaign-runtime-shutdown.service.js';
`,
'',
);

const oldBody = `  campaignEngineShuttingDown = true;
  stopCampaignScheduler();

  pauseAllCampaignRuntimes(
    runtimeStates,
  );

  const stillRunning =
    await waitForCampaignRuntimesToStop({
      runtimeStates,
      timeoutMs,
    });

  if (stillRunning.length > 0) {
    console.warn(
      \`[Campaign Engine] Kapanış zaman aşımı. Devam eden worker sayısı: \${stillRunning.length}. Kampanyalar güvenli kurtarma durumuna alınacak.\`,
    );
  }

  persistCampaignShutdownState();

  resetCampaignRuntimes(
    runtimeStates,
  );`;

const newBody = `  campaignEngineShuttingDown = true;

  await shutdownCampaignRuntimeEngine({
    runtimeStates,
    timeoutMs,
    stopScheduler:
      stopCampaignScheduler,
  });`;

if (!source.includes(oldBody)) {
  throw new Error(
    'shutdownCampaignEngine gövdesi bulunamadı.',
  );
}

source = source.replace(
  oldBody,
  newBody,
);

const forbidden = [
  'pauseAllCampaignRuntimes(',
  'waitForCampaignRuntimesToStop(',
  'persistCampaignShutdownState(',
  'resetCampaignRuntimes(',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken shutdown parçası kaldı: ${marker}`,
    );
  }
}

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

console.log('13G-39 başarıyla uygulandı.');
