const fs = require('fs');

const files = {
  main: 'src/main/main.ts',
  queue: 'src/main/services/campaign-queue.service.ts',
};

function requireFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Dosya bulunamadı: ${path}`);
  }
}

function backup(path) {
  fs.copyFileSync(path, `${path}.before-package-13g-10.bak`);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label} için beklenen eşleşme sayısı 1, bulunan: ${count}`,
    );
  }

  return source.replace(search, replacement);
}

for (const file of Object.values(files)) {
  requireFile(file);
  backup(file);
}

let queue = fs.readFileSync(files.queue, 'utf8');

queue = replaceOnce(
  queue,
  `let campaignSchedulerGeneration = 0;

const scheduledCampaignClaims = new Set<string>();`,
  `let campaignSchedulerGeneration = 0;
let campaignEngineShuttingDown = false;

const scheduledCampaignClaims = new Set<string>();`,
  'campaign shutdown state',
);

queue = replaceOnce(
  queue,
  `export function startCampaign(
  campaignId: string,
): CampaignActionResult {
  const campaign = readCampaign(campaignId);`,
  `export function startCampaign(
  campaignId: string,
): CampaignActionResult {
  if (campaignEngineShuttingDown) {
    throw new Error(
      'Uygulama kapanırken yeni kampanya başlatılamaz.',
    );
  }

  const campaign = readCampaign(campaignId);`,
  'startCampaign shutdown guard',
);

queue = replaceOnce(
  queue,
  `export async function processScheduledCampaigns(): Promise<void> {
  if (campaignSchedulerRunning) {
    return;
  }`,
  `export async function processScheduledCampaigns(): Promise<void> {
  if (campaignEngineShuttingDown || campaignSchedulerRunning) {
    return;
  }`,
  'scheduled campaigns shutdown guard',
);

queue = replaceOnce(
  queue,
  `export function startCampaignScheduler(): void {
  if (campaignSchedulerTimer) {
    return;
  }`,
  `export function startCampaignScheduler(): void {
  if (campaignEngineShuttingDown || campaignSchedulerTimer) {
    return;
  }`,
  'scheduler shutdown guard',
);

const recoveryAnchor = `export function recoverInterruptedCampaigns(): void {`;

const shutdownFunction = `export async function shutdownCampaignEngine(
  timeoutMs = 15000,
): Promise<void> {
  if (campaignEngineShuttingDown) {
    return;
  }

  campaignEngineShuttingDown = true;
  stopCampaignScheduler();

  for (const state of runtimeStates.values()) {
    state.paused = true;
    wakeRuntimeWait(state);
  }

  const deadline = Date.now() + Math.max(1000, timeoutMs);

  while (
    Array.from(runtimeStates.values()).some(
      (state) => state.running,
    ) &&
    Date.now() < deadline
  ) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  const stillRunning = Array.from(runtimeStates.entries())
    .filter(([, state]) => state.running)
    .map(([campaignId]) => campaignId);

  if (stillRunning.length > 0) {
    console.warn(
      \`[Campaign Engine] Kapanış zaman aşımı. Devam eden worker sayısı: \${stillRunning.length}. Kampanyalar güvenli kurtarma durumuna alınacak.\`,
    );
  }

  const database = getDatabase();
  const now = new Date().toISOString();

  const persistShutdownState = database.transaction(() => {
    database.prepare(\`
      UPDATE campaign_recipients
      SET
        status = 'pending',
        error_message = CASE
          WHEN error_message IS NULL OR TRIM(error_message) = ''
            THEN 'Uygulama kontrollü kapandığı için gönderim yeniden kuyruğa alındı.'
          ELSE error_message
        END,
        updated_at = ?
      WHERE status = 'sending'
    \`).run(now);

    database.prepare(\`
      UPDATE campaigns
      SET
        status = 'paused',
        updated_at = ?
      WHERE status = 'running'
    \`).run(now);
  });

  persistShutdownState();

  for (const state of runtimeStates.values()) {
    state.running = false;
    state.wakeWait = undefined;
  }

  runtimeStates.clear();
  scheduledCampaignClaims.clear();
}

`;

queue = replaceOnce(
  queue,
  recoveryAnchor,
  shutdownFunction + recoveryAnchor,
  'shutdown function insertion',
);

fs.writeFileSync(files.queue, queue, 'utf8');

let main = fs.readFileSync(files.main, 'utf8');

main = replaceOnce(
  main,
  `import { closeAllWhatsAppConnections } from './services/whatsapp-connection.service.js';`,
  `import {
  shutdownCampaignEngine,
} from './services/campaign-queue.service.js';
import { closeAllWhatsAppConnections } from './services/whatsapp-connection.service.js';`,
  'main campaign shutdown import',
);

main = replaceOnce(
  main,
  `app.on('before-quit', () => {
  if (applicationShuttingDown) {
    return;
  }

  applicationShuttingDown = true;
  shutdownInboxServices();
  void closeAllWhatsAppConnections();
  closeDatabase();
});`,
  `app.on('before-quit', (event) => {
  if (applicationShuttingDown) {
    return;
  }

  event.preventDefault();
  applicationShuttingDown = true;

  void (async () => {
    try {
      shutdownInboxServices();

      await Promise.all([
        shutdownCampaignEngine(),
        closeAllWhatsAppConnections(),
      ]);
    } catch (reason: unknown) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Bilinmeyen uygulama kapanış hatası.';

      console.error(
        \`[shutdown] Kontrollü kapanış tamamlanamadı: \${message}\`,
      );
    } finally {
      closeDatabase();
      app.quit();
    }
  })();
});`,
  'main graceful shutdown handler',
);

fs.writeFileSync(files.main, main, 'utf8');

console.log('13G-10 kaynak değişiklikleri uygulandı.');
