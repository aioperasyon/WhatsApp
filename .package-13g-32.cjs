const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-runtime-guard.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-runtime-guard.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-32.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const processorImport = `import {
  processCampaignRecipient,
} from './campaign/campaign-recipient-processor.service.js';
`;

const guardImport = `import {
  canStartCampaignRuntime,
  ownsCampaignRuntime,
} from './campaign/campaign-runtime-guard.service.js';
`;

if (!source.includes(processorImport)) {
  throw new Error(
    '13G-31 recipient processor import işareti bulunamadı.',
  );
}

if (!source.includes(guardImport)) {
  source = source.replace(
    processorImport,
    processorImport + guardImport,
  );
}

const initialGuard = `  if (
    !state ||
    state.running ||
    state.runId !== expectedRunId
  ) {
    return;
  }`;

const initialReplacement = `  if (
    !canStartCampaignRuntime(
      state,
      expectedRunId,
    )
  ) {
    return;
  }`;

if (!source.includes(initialGuard)) {
  throw new Error(
    'Queue başlangıç runtime guard bloğu bulunamadı.',
  );
}

source = source.replace(
  initialGuard,
  initialReplacement,
);

const loopGuard = `      if (
        currentState !== state ||
        state.runId !== expectedRunId
      ) {`;

const loopReplacement = `      if (
        !ownsCampaignRuntime(
          currentState,
          state,
          expectedRunId,
        )
      ) {`;

if (!source.includes(loopGuard)) {
  throw new Error(
    'Queue döngü runtime ownership bloğu bulunamadı.',
  );
}

source = source.replace(
  loopGuard,
  loopReplacement,
);

const finalOwnership = `    const ownsRuntime =
      runtimeStates.get(campaignId) === state &&
      state.runId === expectedRunId;`;

const finalReplacement = `    const ownsRuntime =
      ownsCampaignRuntime(
        runtimeStates.get(campaignId),
        state,
        expectedRunId,
      );`;

if (!source.includes(finalOwnership)) {
  throw new Error(
    'Queue final runtime ownership bloğu bulunamadı.',
  );
}

source = source.replace(
  finalOwnership,
  finalReplacement,
);

const forbidden = [
  'state.runId !== expectedRunId',
  'runtimeStates.get(campaignId) === state &&',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken runtime kontrolü kaldı: ${marker}`,
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

console.log('13G-32 başarıyla uygulandı.');
