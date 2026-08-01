
const fs = require('fs');

const file = 'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(file)) {
  throw new Error(`Dosya bulunamadi: ${file}`);
}

fs.copyFileSync(
  file,
  `${file}.before-package-13g-5-fix-1.bak`,
);

let source = fs.readFileSync(file, 'utf8');

const brokenBlock = `      const recipient = getDatabase()
      // Queue state refresh after long waits
      state.currentCampaign = getCampaignById(state.currentCampaign.id) ?? state.currentCampaign;

      const recipient = getDatabase()
        .prepare(\``;

const restoredBlock = `      const recipient = getDatabase()
        .prepare(\``;

if (source.includes(brokenBlock)) {
  source = source.replace(brokenBlock, restoredBlock);
} else {
  const marker = '// Queue state refresh after long waits';

  if (source.includes(marker)) {
    const lines = source.split(/\r?\n/);
    const cleaned = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (line.includes(marker)) {
        if (
          cleaned.length > 0 &&
          cleaned[cleaned.length - 1].trim() ===
            'const recipient = getDatabase()'
        ) {
          cleaned.pop();
        }

        while (
          index + 1 < lines.length &&
          !lines[index + 1].includes(
            'const recipient = getDatabase()',
          )
        ) {
          index += 1;
        }

        continue;
      }

      cleaned.push(line);
    }

    source = cleaned.join('\n');
  } else if (
    source.includes(
      'state.currentCampaign = getCampaignById(state.currentCampaign.id)',
    )
  ) {
    source = source.replace(
      /\s*\/\/ Queue state refresh after long waits\s*\n\s*state\.currentCampaign\s*=\s*getCampaignById\([^\n]+\)\s*\?\?\s*state\.currentCampaign;\s*\n/gu,
      '\n',
    );
  } else {
    throw new Error(
      '13G-5 tarafindan eklenen hatali kod blogu bulunamadi.',
    );
  }
}

if (
  source.includes('state.currentCampaign') ||
  source.includes('getCampaignById(')
) {
  throw new Error(
    'Hatali state.currentCampaign veya getCampaignById kodu tamamen temizlenemedi.',
  );
}

const recipientQueryPattern =
  /const recipient = getDatabase\(\)\s*\n\s*\.prepare\(`/gu;

const recipientQueryMatches =
  source.match(recipientQueryPattern) ?? [];

if (recipientQueryMatches.length !== 1) {
  throw new Error(
    `Beklenen alici sorgusu sayisi 1 olmaliydi, bulunan: ${recipientQueryMatches.length}`,
  );
}

fs.writeFileSync(file, source, 'utf8');

console.log(`Guncellendi: ${file}`);
console.log(
  '13G-5 tarafindan yanlis konuma eklenen queue refresh kodu kaldirildi.',
);
console.log(
  'Alici sorgusunun getDatabase().prepare zinciri geri yuklendi.',
);
