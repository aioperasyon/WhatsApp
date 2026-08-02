const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const serviceSource =
  'files/src/main/services/campaign/campaign-queue-gate.service.ts';
const serviceTarget =
  'src/main/services/campaign/campaign-queue-gate.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(serviceSource)) {
  throw new Error(`Dosya bulunamadı: ${serviceSource}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-34.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const cleanupImport = `import {
  removeFinishedCampaignRuntimeState,
} from './campaign/campaign-runtime-cleanup.service.js';
`;

const gateImport = `import {
  getCampaignQueueGate,
} from './campaign/campaign-queue-gate.service.js';
`;

if (!source.includes(cleanupImport)) {
  throw new Error(
    '13G-33 runtime cleanup import işareti bulunamadı.',
  );
}

if (!source.includes(gateImport)) {
  source = source.replace(
    cleanupImport,
    cleanupImport + gateImport,
  );
}

source = source.replace(
`import {
  countCampaignRecipientsSentToday,
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';`,
`import {
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';`,
);

source = source.replace(
`import {
  millisecondsUntilCampaignWorkingWindow,
  millisecondsUntilNextCampaignDay,
  randomCampaignInteger,
} from './campaign/campaign-timing.service.js';`,
`import {
  randomCampaignInteger,
} from './campaign/campaign-timing.service.js';`,
);

const oldBlock = `      const workingWait = millisecondsUntilCampaignWorkingWindow(
        campaign.settings.workStartTime,
        campaign.settings.workEndTime,
      );

      if (workingWait > 0) {
        const continued = await waitForCampaignRuntime(state, workingWait);

        if (!continued) {
          continue;
        }

        // Bekleme sırasında kampanya ayarları veya durumu değişmiş
        // olabilir. Güncel kampanyayı yeniden okuyup tüm kontrolleri
        // baştan çalıştırmak için döngünün başına dön.
        continue;
      }

      const dailyLimit = campaign.settings.dailyLimit;
      if (
        dailyLimit !== null &&
        dailyLimit > 0 &&
        countCampaignRecipientsSentToday(campaignId) >= dailyLimit
      ) {
        const continued = await waitForCampaignRuntime(
          state,
          millisecondsUntilNextCampaignDay(),
        );
        if (!continued) {
          continue;
        }

        // Yeni gün başladığında günlük sayaç, çalışma saati ve
        // kampanya durumu güncel verilerle tekrar doğrulansın.
        continue;
      }`;

const newBlock = `      const queueGate =
        getCampaignQueueGate(campaign);

      if (queueGate.type !== 'ready') {
        const continued =
          await waitForCampaignRuntime(
            state,
            queueGate.waitMs,
          );

        if (!continued) {
          continue;
        }

        continue;
      }`;

if (!source.includes(oldBlock)) {
  throw new Error(
    'Queue gate bloğu bulunamadı.',
  );
}

source = source.replace(
  oldBlock,
  newBlock,
);

const forbidden = [
  'millisecondsUntilCampaignWorkingWindow(',
  'millisecondsUntilNextCampaignDay(',
  'countCampaignRecipientsSentToday(',
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

console.log('13G-34 başarıyla uygulandı.');
