const fs = require('fs');

const queueFile =
  'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-40-fix-1.bak`,
);

let source = fs.readFileSync(queueFile, 'utf8');

const lifecycleImport = `import {
  cancelCampaignLifecycle,
  pauseCampaignLifecycle,
  resumeCampaignLifecycle,
  startCampaignLifecycle,
} from './campaign/campaign-lifecycle.service.js';
`;

const runtimeTypeImport = `import type {
  CampaignRuntimeState,
} from './campaign/campaign-runtime-state.service.js';
`;

if (!source.includes(lifecycleImport)) {
  throw new Error(
    '13G-40 lifecycle import işareti bulunamadı.',
  );
}

if (!source.includes(runtimeTypeImport)) {
  source = source.replace(
    lifecycleImport,
    lifecycleImport + runtimeTypeImport,
  );
}

const runtimeMap = `const runtimeStates =
  new Map<string, CampaignRuntimeState>();`;

if (!source.includes(runtimeMap)) {
  throw new Error(
    'runtimeStates Map tanımı bulunamadı.',
  );
}

fs.writeFileSync(
  queueFile,
  source,
  'utf8',
);

console.log(
  '13G-40-FIX-1 başarıyla uygulandı.',
);
