const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-runtime-cleanup.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-runtime-cleanup.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-33.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const guardImport = `import {
  canStartCampaignRuntime,
  ownsCampaignRuntime,
} from './campaign/campaign-runtime-guard.service.js';
`;

const cleanupImport = `import {
  removeFinishedCampaignRuntimeState,
} from './campaign/campaign-runtime-cleanup.service.js';
`;

if (!source.includes(guardImport)) {
  throw new Error(
    '13G-32 runtime guard import işareti bulunamadı.',
  );
}

if (!source.includes(cleanupImport)) {
  source = source.replace(
    guardImport,
    guardImport + cleanupImport,
  );
}

const localFunction = `function removeFinishedRuntimeState(
  campaignId: string,
  state: CampaignRuntimeState,
): void {
  const status =
    getCampaignStatus(campaignId);

  if (
    status === null ||
    isTerminalCampaignStatus(status as CampaignStatus)
  ) {
    state.wakeWait = undefined;
    runtimeStates.delete(campaignId);
  }
}

`;

if (!source.includes(localFunction)) {
  throw new Error(
    'removeFinishedRuntimeState fonksiyonu bulunamadı.',
  );
}

source = source.replace(
  localFunction,
  '',
);

source = source.replace(
`        removeFinishedRuntimeState(campaignId, state);`,
`        removeFinishedCampaignRuntimeState({
          campaignId,
          state,
          getStatus: getCampaignStatus,
          deleteState: (id) =>
            runtimeStates.delete(id),
        });`,
);

source = source.replace(
`      removeFinishedRuntimeState(campaignId, state);`,
`      removeFinishedCampaignRuntimeState({
        campaignId,
        state,
        getStatus: getCampaignStatus,
        deleteState: (id) =>
          runtimeStates.delete(id),
      });`,
);

if (source.includes('removeFinishedRuntimeState(')) {
  throw new Error(
    'Queue dosyasında eski runtime cleanup çağrısı kaldı.',
  );
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

console.log('13G-33 başarıyla uygulandı.');
