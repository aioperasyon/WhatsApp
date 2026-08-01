const fs = require('fs');

const file = 'src/main/ipc/register-campaign-ipc.ts';

if (!fs.existsSync(file)) {
  throw new Error(`Dosya bulunamadı: ${file}`);
}

fs.copyFileSync(
  file,
  `${file}.before-package-13g-12-fix-2.bak`,
);

let source = fs.readFileSync(file, 'utf8');

if (!source.includes('function normalizeValues(')) {
  const marker = 'function buildAudienceWhere(';
  const index = source.indexOf(marker);

  if (index === -1) {
    throw new Error('buildAudienceWhere fonksiyonu bulunamadı.');
  }

  const helper = `function normalizeValues(
  values: string[] | undefined,
): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'tr'));
}

`;

  source =
    source.slice(0, index) +
    helper +
    source.slice(index);
}

fs.writeFileSync(file, source, 'utf8');

console.log('13G-12-FIX-2 başarıyla uygulandı.');
