const fs = require('fs');
const path = require('path');

const queueFile =
  'src/main/services/campaign-queue.service.ts';
const repositorySource =
  'files/src/main/repositories/campaign-recipient-lifecycle.repository.ts';
const repositoryTarget =
  'src/main/repositories/campaign-recipient-lifecycle.repository.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(`Dosya bulunamadı: ${queueFile}`);
}

if (!fs.existsSync(repositorySource)) {
  throw new Error(
    `Repository kaynak dosyası bulunamadı: ${repositorySource}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-15.bak`,
);

if (fs.existsSync(repositoryTarget)) {
  fs.copyFileSync(
    repositoryTarget,
    `${repositoryTarget}.before-package-13g-15.bak`,
  );
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

let source = fs.readFileSync(queueFile, 'utf8');

source = source.replace(
  `  CampaignRecipientStatus,\n`,
  '',
);

const recipientInterfaceStart =
  source.indexOf('interface RecipientRow {');
const runtimeInterfaceStart =
  source.indexOf(
    'interface RuntimeState {',
    recipientInterfaceStart,
  );

if (
  recipientInterfaceStart === -1 ||
  runtimeInterfaceStart === -1
) {
  throw new Error(
    'RecipientRow interface bloğu bulunamadı.',
  );
}

source =
  source.slice(0, recipientInterfaceStart) +
  source.slice(runtimeInterfaceStart);

const importMarker = `import {
  countCampaignRecipientsSentToday,
  refreshCampaignRecipientCounts,
  seedCampaignRecipients,
} from '../repositories/campaign-recipient-queue.repository.js';
`;

const lifecycleImport = `import {
  claimCampaignRecipient,
  countPendingCampaignRecipients,
  findNextPendingCampaignRecipient,
  markCampaignRecipientFailed,
  markCampaignRecipientPending,
  markCampaignRecipientSent,
} from '../repositories/campaign-recipient-lifecycle.repository.js';
`;

if (!source.includes(importMarker)) {
  throw new Error(
    'Recipient queue repository import işareti bulunamadı.',
  );
}

if (!source.includes(lifecycleImport)) {
  source = source.replace(
    importMarker,
    importMarker + lifecycleImport,
  );
}

source = replaceOnce(
  source,
  `      const recipient = getDatabase()
        .prepare(\`
          SELECT *
          FROM campaign_recipients
          WHERE campaign_id = ? AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
        \`)
        .get(campaignId) as RecipientRow | undefined;`,
  `      const recipient =
        findNextPendingCampaignRecipient(campaignId);`,
  'next recipient query',
);

source = replaceOnce(
  source,
  `          getDatabase().prepare(\`
            UPDATE campaign_recipients
            SET status = 'pending', updated_at = ?
            WHERE id = ?
          \`).run(new Date().toISOString(), recipient.id);`,
  `          markCampaignRecipientPending(
            recipient.id,
            new Date().toISOString(),
          );`,
  'pause pending update',
);

source = replaceOnce(
  source,
  `        const attemptStartedAt = new Date().toISOString();
        const claimResult = getDatabase()
          .prepare(\`
            UPDATE campaign_recipients
            SET
              status = 'sending',
              attempt_count = attempt_count + 1,
              error_message = NULL,
              updated_at = ?
            WHERE id = ?
              AND status = 'pending'
          \`)
          .run(attemptStartedAt, recipient.id);

        if (claimResult.changes === 0) {`,
  `        const attemptStartedAt = new Date().toISOString();
        const recipientClaimSucceeded =
          claimCampaignRecipient(
            recipient.id,
            attemptStartedAt,
          );

        if (!recipientClaimSucceeded) {`,
  'recipient claim',
);

source = replaceOnce(
  source,
  `          getDatabase().prepare(\`
            UPDATE campaign_recipients
            SET
              status = 'sent',
              error_message = NULL,
              whatsapp_message_id = ?,
              sent_at = ?,
              updated_at = ?
            WHERE id = ?
          \`).run(
            result.whatsappMessageId,
            sentAt,
            sentAt,
            recipient.id,
          );`,
  `          markCampaignRecipientSent({
            recipientId: recipient.id,
            whatsappMessageId:
              result.whatsappMessageId,
            sentAt,
          });`,
  'recipient sent update',
);

source = replaceOnce(
  source,
  `            getDatabase().prepare(\`
              UPDATE campaign_recipients
              SET
                status = 'failed',
                error_message = ?,
                updated_at = ?
              WHERE id = ?
            \`).run(
              lastErrorMessage,
              new Date().toISOString(),
              recipient.id,
            );`,
  `            markCampaignRecipientFailed(
              recipient.id,
              lastErrorMessage,
              new Date().toISOString(),
            );`,
  'recipient failed update',
);

source = replaceOnce(
  source,
  `          getDatabase().prepare(\`
            UPDATE campaign_recipients
            SET
              status = 'pending',
              error_message = ?,
              updated_at = ?
            WHERE id = ?
          \`).run(
            \`Tekrar denenecek (\${currentAttempt}/\${maximumAttempts - 1}): \${lastErrorMessage}\`,
            new Date().toISOString(),
            recipient.id,
          );`,
  `          markCampaignRecipientPending(
            recipient.id,
            new Date().toISOString(),
            \`Tekrar denenecek (\${currentAttempt}/\${maximumAttempts - 1}): \${lastErrorMessage}\`,
          );`,
  'recipient retry pending update',
);

source = replaceOnce(
  source,
  `            getDatabase().prepare(\`
              UPDATE campaign_recipients
              SET status = 'pending', updated_at = ?
              WHERE id = ?
            \`).run(new Date().toISOString(), recipient.id);`,
  `            markCampaignRecipientPending(
              recipient.id,
              new Date().toISOString(),
            );`,
  'interrupted retry pending update',
);

source = replaceOnce(
  source,
  `  const remaining = getDatabase()
    .prepare(\`
      SELECT COUNT(*) AS total
      FROM campaign_recipients
      WHERE campaign_id = ? AND status = 'pending'
    \`)
    .get(campaignId) as { total: number };

  if (Number(remaining.total ?? 0) === 0) {`,
  `  const remaining =
    countPendingCampaignRecipients(campaignId);

  if (remaining === 0) {`,
  'pending recipient count',
);

const forbidden = [
  'interface RecipientRow',
  'CampaignRecipientStatus',
  'as RecipientRow',
  'claimResult.changes',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(
      `Queue dosyasında taşınması gereken parça kaldı: ${marker}`,
    );
  }
}

fs.mkdirSync(
  path.dirname(repositoryTarget),
  { recursive: true },
);

fs.copyFileSync(
  repositorySource,
  repositoryTarget,
);

fs.writeFileSync(queueFile, source, 'utf8');

console.log('13G-15 başarıyla uygulandı.');
