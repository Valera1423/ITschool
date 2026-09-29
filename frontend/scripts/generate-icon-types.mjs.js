// frontend/scripts/generate-icon-types.mjs
import { readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/assets/icons';
const OUT = 'src/components/ui/iconNames.ts';

function walk(dir, base = ROOT) {
  const names = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      names.push(...walk(p, base));
    } else if (name.endsWith('.svg')) {
      names.push(relative(base, p).replace(/\.svg$/, ''));
    }
  }
  return names;
}

const names = walk(ROOT).sort();

const content = `// АВТОГЕНЕРАЦИЯ. Не редактируйте вручную.
// Запуск: node scripts/generate-icon-types.mjs

export const ICON_NAMES = ${JSON.stringify(names, null, 2)} as const;

export type IconName = (typeof ICON_NAMES)[number];
`;

writeFileSync(OUT, content);
console.log(`✓ Сгенерировано ${names.length} иконок → ${OUT}`);