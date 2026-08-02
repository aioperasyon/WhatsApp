const fs = require('fs');

const queueFile =
  'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(
    `Dosya bulunamadı: ${queueFile}`,
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-43-fix-2.bak`,
);

let source = fs.readFileSync(
  queueFile,
  'utf8',
);

source = source
  .replace(/[ \t]+\r?\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd() + '\n';

fs.writeFileSync(
  queueFile,
  source,
  'utf8',
);

console.log(
  '13G-43-FIX-2 başarıyla uygulandı.',
);
