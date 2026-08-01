
const fs = require('fs');

const file = 'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(file)) {
  throw new Error(`Dosya bulunamadi: ${file}`);
}

fs.copyFileSync(
  file,
  `${file}.before-package-13g-5-fix-2.bak`,
);

let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  /^[ \t]*\/\/ Queue state refresh after long waits[^\r\n]*\r?\n/gm,
  '',
);

source = source.replace(
  /^[ \t]*state\.currentCampaign\s*=\s*getCampaignById\([^\r\n]*\r?\n/gm,
  '',
);

const selectMarker =
  "SELECT *\n          FROM campaign_recipients\n          WHERE campaign_id = ? AND status = 'pending'";

let selectIndex = source.indexOf(selectMarker);

if (selectIndex === -1) {
  const normalized = source.replace(/\r\n/g, '\n');
  selectIndex = normalized.indexOf(selectMarker);

  if (selectIndex === -1) {
    throw new Error(
      'Pending kampanya alicisi SELECT blogu bulunamadi.',
    );
  }

  source = normalized;
}

const prepareIndex = source.lastIndexOf('.prepare(`', selectIndex);

if (prepareIndex === -1) {
  throw new Error(
    'Pending alici sorgusunun prepare cagrisi bulunamadi.',
  );
}

const lineStart = source.lastIndexOf('\n', prepareIndex) + 1;
const prefix = source.slice(
  Math.max(0, lineStart - 300),
  prepareIndex,
);

const recipientDeclarationIndex = prefix.lastIndexOf(
  'const recipient = getDatabase()',
);

if (recipientDeclarationIndex === -1) {
  source =
    source.slice(0, lineStart) +
    '      const recipient = getDatabase()\n' +
    source.slice(lineStart);
} else {
  const absoluteDeclarationIndex =
    Math.max(0, lineStart - 300) +
    recipientDeclarationIndex;

  const between = source.slice(
    absoluteDeclarationIndex,
    prepareIndex,
  );

  const declarationCount =
    (between.match(/const recipient = getDatabase\(\)/g) ?? [])
      .length;

  if (declarationCount > 1) {
    const cleanedBetween = between.replace(
      /const recipient = getDatabase\(\)\s*/g,
      '',
    );

    source =
      source.slice(0, absoluteDeclarationIndex) +
      'const recipient = getDatabase()\n        ' +
      cleanedBetween +
      source.slice(prepareIndex);
  }
}

source = source.replace(
  /const recipient = getDatabase\(\)\s*\n\s*const recipient = getDatabase\(\)/g,
  'const recipient = getDatabase()',
);

source = source.replace(
  /const recipient = getDatabase\(\)\s*\n\s*\n\s*\.prepare\(`/g,
  'const recipient = getDatabase()\n        .prepare(`',
);

source = source.replace(
  /^\s*\.prepare\(`\s*\n(\s*SELECT \*\s*\n\s*FROM campaign_recipients)/m,
  '      const recipient = getDatabase()\n        .prepare(`\n$1',
);

if (
  source.includes('state.currentCampaign') ||
  source.includes('getCampaignById(') ||
  source.includes('Queue state refresh after long waits')
) {
  throw new Error(
    '13G-5 tarafindan eklenen hatali kod tamamen temizlenemedi.',
  );
}

if (
  !/const recipient = getDatabase\(\)\s*\.prepare\(`\s*SELECT \*\s*FROM campaign_recipients/s.test(
    source,
  )
) {
  throw new Error(
    'Pending alici sorgusu dogru bicimde geri yuklenemedi.',
  );
}

fs.writeFileSync(file, source, 'utf8');

console.log(`Guncellendi: ${file}`);
console.log(
  'Bozulan pending alici sorgusu getDatabase().prepare zinciri geri yuklendi.',
);
