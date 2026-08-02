const fs = require('fs');

const loadedTypescript = require('typescript');
const ts =
  loadedTypescript.default ??
  loadedTypescript;

const queueFile =
  'src/main/services/campaign-queue.service.ts';

if (!fs.existsSync(queueFile)) {
  throw new Error(
    `Dosya bulunamadı: ${queueFile}`,
  );
}

if (
  !ts ||
  !ts.ScriptTarget ||
  !ts.ScriptKind ||
  typeof ts.createSourceFile !== 'function'
) {
  throw new Error(
    'TypeScript compiler API yüklenemedi.',
  );
}

fs.copyFileSync(
  queueFile,
  `${queueFile}.before-package-13g-43-fix-1.bak`,
);

const sourceText =
  fs.readFileSync(queueFile, 'utf8');

const sourceFile =
  ts.createSourceFile(
    queueFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const usedIdentifiers = new Set();

function collectUsedIdentifiers(node) {
  if (
    ts.isImportDeclaration(node) ||
    ts.isExportDeclaration(node)
  ) {
    return;
  }

  if (ts.isIdentifier(node)) {
    usedIdentifiers.add(node.text);
  }

  ts.forEachChild(
    node,
    collectUsedIdentifiers,
  );
}

collectUsedIdentifiers(sourceFile);

const replacements = [];

for (const statement of sourceFile.statements) {
  if (!ts.isImportDeclaration(statement)) {
    continue;
  }

  const clause = statement.importClause;

  if (!clause) {
    continue;
  }

  const moduleText =
    statement.moduleSpecifier.getText(
      sourceFile,
    );

  const keptParts = [];

  if (
    clause.name &&
    usedIdentifiers.has(clause.name.text)
  ) {
    keptParts.push(clause.name.text);
  }

  const bindings = clause.namedBindings;

  if (
    bindings &&
    ts.isNamespaceImport(bindings) &&
    usedIdentifiers.has(bindings.name.text)
  ) {
    keptParts.push(
      `* as ${bindings.name.text}`,
    );
  }

  if (
    bindings &&
    ts.isNamedImports(bindings)
  ) {
    const keptElements =
      bindings.elements.filter(
        (element) =>
          usedIdentifiers.has(
            element.name.text,
          ),
      );

    if (keptElements.length > 0) {
      const names = keptElements.map(
        (element) => {
          const imported =
            element.propertyName?.text;
          const local =
            element.name.text;
          const typePrefix =
            element.isTypeOnly
              ? 'type '
              : '';

          return imported &&
            imported !== local
            ? `${typePrefix}${imported} as ${local}`
            : `${typePrefix}${local}`;
        },
      );

      keptParts.push(
        `{\n  ${names.join(',\n  ')},\n}`,
      );
    }
  }

  if (keptParts.length === 0) {
    replacements.push({
      start: statement.getFullStart(),
      end: statement.getEnd(),
      text: '',
    });
    continue;
  }

  const typePrefix =
    clause.isTypeOnly
      ? 'type '
      : '';

  replacements.push({
    start: statement.getStart(sourceFile),
    end: statement.getEnd(),
    text:
      `import ${typePrefix}${keptParts.join(', ')} from ${moduleText};`,
  });
}

let updated = sourceText;

for (
  const replacement
  of replacements.sort(
    (a, b) => b.start - a.start,
  )
) {
  updated =
    updated.slice(0, replacement.start) +
    replacement.text +
    updated.slice(replacement.end);
}

updated = updated
  .replace(/\n{3,}/g, '\n\n')
  .trimStart();

fs.writeFileSync(
  queueFile,
  updated,
  'utf8',
);

console.log(
  '13G-43-FIX-1 başarıyla uygulandı.',
);
