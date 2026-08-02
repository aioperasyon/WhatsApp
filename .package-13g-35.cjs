const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-post-send-delay.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-post-send-delay.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-35.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const gateImport = `import {
  getCampaignQueueGate,
} from './campaign/campaign-queue-gate.service.js';
`;

const delayImport = `import {
  getCampaignPostSendDelay,
} from './campaign/campaign-post-send-delay.service.js';
`;

if (!source.includes(gateImport)) {
  throw new Error(
    '13G-34 queue gate import işareti bulunamadı.',
  );
}

if (!source.includes(delayImport)) {
  source = source.replace(
    gateImport,
    gateImport + delayImport,
  );
}

source = source.replace(
`import {
  randomCampaignInteger,
} from './campaign/campaign-timing.service.js';
`,
'',
);

source = source.replace(
`import {
  getCampaignBatchSize,
} from './campaign/campaign-delivery-policy.service.js';
`,
'',
);

const oldBlock = `      if (sentSuccessfully) {
        sentSinceBatchPause += 1;
      }

      const batchSize = getCampaignBatchSize(
        campaign.settings.batchSize,
      );
      if (sentSinceBatchPause >= batchSize) {
        sentSinceBatchPause = 0;
        const batchPauseSeconds = randomCampaignInteger(
          campaign.settings.batchPauseMinSeconds,
          campaign.settings.batchPauseMaxSeconds,
        );
        await waitForCampaignRuntime(state, batchPauseSeconds * 1000);
        continue;
      }

      const delaySeconds = randomCampaignInteger(
        campaign.settings.minDelaySeconds,
        campaign.settings.maxDelaySeconds,
      );
      await waitForCampaignRuntime(state, delaySeconds * 1000);`;

const newBlock = `      const postSendDelay =
        getCampaignPostSendDelay({
          campaign,
          sentSuccessfully,
          sentSinceBatchPause,
        });

      sentSinceBatchPause =
        postSendDelay.sentSinceBatchPause;

      await waitForCampaignRuntime(
        state,
        postSendDelay.waitMs,
      );`;

if (!source.includes(oldBlock)) {
  throw new Error(
    'Post-send delay bloğu bulunamadı.',
  );
}

source = source.replace(
  oldBlock,
  newBlock,
);

const forbidden = [
  'getCampaignBatchSize(',
  'randomCampaignInteger(',
  'batchPauseSeconds',
  'delaySeconds',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
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

console.log('13G-35 başarıyla uygulandı.');
