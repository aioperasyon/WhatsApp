const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-recipient-processor.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-recipient-processor.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-31.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const runtimeStateImport = `import {
  createCampaignRuntimeState,
  prepareCampaignRuntimeState,
  type CampaignRuntimeState,
} from './campaign/campaign-runtime-state.service.js';
`;

const processorImport = `import {
  processCampaignRecipient,
} from './campaign/campaign-recipient-processor.service.js';
`;

if (!source.includes(runtimeStateImport)) {
  throw new Error(
    '13G-30 runtime state import işareti bulunamadı.',
  );
}

if (!source.includes(processorImport)) {
  source = source.replace(
    runtimeStateImport,
    runtimeStateImport + processorImport,
  );
}

source = source.replace(
`import {
  claimCampaignRecipient,
  countPendingCampaignRecipients,
  findNextPendingCampaignRecipient,
  markCampaignRecipientFailed,
  markCampaignRecipientPending,
  markCampaignRecipientSent,
} from '../repositories/campaign-recipient-lifecycle.repository.js';`,
`import {
  countPendingCampaignRecipients,
  findNextPendingCampaignRecipient,
} from '../repositories/campaign-recipient-lifecycle.repository.js';`,
);

source = source.replace(
`import {
  getCampaignBatchSize,
  getCampaignMaximumAttempts,
  getCampaignRetryWaitSeconds,
} from './campaign/campaign-delivery-policy.service.js';`,
`import {
  getCampaignBatchSize,
} from './campaign/campaign-delivery-policy.service.js';`,
);

source = source.replace(
`import {
  formatCampaignRetryError,
  getCampaignErrorMessage,
} from './campaign/campaign-error-policy.service.js';`,
`import {
  getCampaignErrorMessage,
} from './campaign/campaign-error-policy.service.js';`,
);

source = source.replace(
`import { sendCampaignMessage } from './whatsapp-connection.service.js';
`,
'',
);

const blockStart = `      const maximumAttempts =
        getCampaignMaximumAttempts(
          campaign.settings.retryCount,
        );
      let sentSuccessfully = false;
      let recipientClaimed = false;
      let lastErrorMessage: string | null = null;

      for (
        let currentAttempt = 1;
        currentAttempt <= maximumAttempts;
        currentAttempt += 1
      ) {`;

const blockEnd = `      refreshCampaignRecipientCounts(campaignId);`;

const startIndex = source.indexOf(blockStart);

if (startIndex === -1) {
  throw new Error(
    'Recipient processing başlangıcı bulunamadı.',
  );
}

const endIndex = source.indexOf(
  blockEnd,
  startIndex,
);

if (endIndex === -1) {
  throw new Error(
    'Recipient processing bitişi bulunamadı.',
  );
}

const replacement = `      const {
        recipientClaimed,
        sentSuccessfully,
      } = await processCampaignRecipient({
        campaign,
        recipient,
        state,
      });

`;

source =
  source.slice(0, startIndex) +
  replacement +
  source.slice(endIndex);

const forbidden = [
  'claimCampaignRecipient(',
  'markCampaignRecipientFailed(',
  'markCampaignRecipientPending(',
  'markCampaignRecipientSent(',
  'sendCampaignMessage(',
  'formatCampaignRetryError(',
  'getCampaignMaximumAttempts(',
  'getCampaignRetryWaitSeconds(',
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

console.log('13G-31 başarıyla uygulandı.');
