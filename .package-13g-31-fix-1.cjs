const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const backupFile =
  'src/main/services/campaign-queue.service.ts.before-package-13g-31.bak';
const serviceSource =
  'files/src/main/services/campaign/campaign-recipient-processor.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-recipient-processor.service.ts';

if (!fs.existsSync(backupFile)) {
  throw new Error(`13G-31 yedeği bulunamadı: ${backupFile}`);
}

fs.copyFileSync(backupFile, queueFile);

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
  throw new Error('13G-30 runtime state import işareti bulunamadı.');
}

source = source.replace(
  runtimeStateImport,
  runtimeStateImport + processorImport,
);

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
  `import { sendCampaignMessage } from './whatsapp-connection.service.js';\n`,
  '',
);

const startMarker = `      const maximumAttempts =
        getCampaignMaximumAttempts(`;

const endMarker = `      refreshCampaignRecipientCounts(campaignId);

      if (!recipientClaimed) {`;

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1) {
  throw new Error('Recipient processing başlangıcı bulunamadı.');
}

if (end === -1) {
  throw new Error('Recipient processing bitişi bulunamadı.');
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
  source.slice(0, start) +
  replacement +
  source.slice(end);

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

fs.mkdirSync(path.dirname(serviceTarget), { recursive: true });
fs.copyFileSync(serviceSource, serviceTarget);
fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-31-FIX-1 başarıyla uygulandı.');
