const fs=require('fs'),path=require('path');
const q='src/main/services/campaign-queue.service.ts';
const s='files/src/main/services/campaign/campaign-lifecycle.service.ts';
const t='src/main/services/campaign/campaign-lifecycle.service.ts';
if(!fs.existsSync(q))throw new Error('Queue dosyası bulunamadı.');
fs.copyFileSync(q,q+'.before-package-13g-40.bak');
let x=fs.readFileSync(q,'utf8');
const a=`import {
  shutdownCampaignRuntimeEngine,
} from './campaign/campaign-engine-shutdown.service.js';
`;
const i=`import {
  cancelCampaignLifecycle,
  pauseCampaignLifecycle,
  resumeCampaignLifecycle,
  startCampaignLifecycle,
} from './campaign/campaign-lifecycle.service.js';
`;
if(!x.includes(a))throw new Error('13G-39 import işareti bulunamadı.');
x=x.replace(a,a+i);
const start=x.indexOf('export function startCampaign(');
const end=x.indexOf('function getCampaignSchedulerDependencies()',start);
if(start<0||end<0)throw new Error('Lifecycle fonksiyon sınırları bulunamadı.');
const w=`function getCampaignLifecycleDependencies() {
  return {
    runtimeStates,
    isShuttingDown: () => campaignEngineShuttingDown,
    runQueue,
  };
}

export function startCampaign(campaignId: string): CampaignActionResult {
  return startCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}

export function pauseCampaign(campaignId: string): CampaignActionResult {
  return pauseCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}

export function resumeCampaign(campaignId: string): CampaignActionResult {
  return resumeCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}

export function cancelCampaign(campaignId: string): CampaignActionResult {
  return cancelCampaignLifecycle(campaignId, getCampaignLifecycleDependencies());
}

`;
x=x.slice(0,start)+w+x.slice(end);
const blocks=[
`import {
  cancelCampaignRecord,
  failCampaignRecord,
  pauseCampaignRecord,
  resumeCampaignRecord,
} from '../repositories/campaign-control.repository.js';`,
`import {
  claimCampaignStart,
  completeCampaign,
  getCampaignStatus,
  reconcileCampaignState,
} from '../repositories/campaign-state.repository.js';`,
`import {
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';`,
`import {
  countPendingCampaignRecipients,
  findNextPendingCampaignRecipient,
} from '../repositories/campaign-recipient-lifecycle.repository.js';`,
`import {
  readCampaign,
} from './campaign/campaign-reader.service.js';`,
`import {
  getStartableCampaignStatuses,
  isStartableCampaignStatus,
  isTerminalCampaignStatus,
} from './campaign/campaign-status-policy.service.js';`,
`import {
  getCampaignErrorMessage,
} from './campaign/campaign-error-policy.service.js';`,
`import {
  createCampaignRuntimeState,
  prepareCampaignRuntimeState,
  type CampaignRuntimeState,
} from './campaign/campaign-runtime-state.service.js';`,
`import {
  waitForCampaignRuntime,
  wakeCampaignRuntime,
} from './campaign/campaign-runtime-wait.service.js';`,
`import {
  canStartCampaignRuntime,
  ownsCampaignRuntime,
} from './campaign/campaign-runtime-guard.service.js';`,
`import {
  removeFinishedCampaignRuntimeState,
} from './campaign/campaign-runtime-cleanup.service.js';`,
`import {
  getCampaignQueueGate,
} from './campaign/campaign-queue-gate.service.js';`,
`import {
  getCampaignPostSendDelay,
} from './campaign/campaign-post-send-delay.service.js';`,
`import {
  processCampaignRecipient,
} from './campaign/campaign-recipient-processor.service.js';`
];
for(const b of blocks){x=x.replace(b+'\n','').replace(b,'');}
x=x.replace(`import type {
  CampaignActionResult,
  CampaignStatus,
} from '../../../shared/interfaces/campaign.js';`,`import type {
  CampaignActionResult,
} from '../../../shared/interfaces/campaign.js';`);
fs.mkdirSync(path.dirname(t),{recursive:true});fs.copyFileSync(s,t);fs.writeFileSync(q,x,'utf8');
console.log('13G-40 başarıyla uygulandı.');
