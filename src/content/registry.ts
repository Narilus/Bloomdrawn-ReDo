import type { Registry } from '../engine/index.ts';
import { buildRegistry } from './validate.ts';

export { buildRegistry, validateContent } from './validate.ts';

/** The game's content registry, built from every content file (the folders in CONTENT_FOLDERS). */
export const registry: Registry = buildRegistry(
  import.meta.glob(
    ['./characters/**/*.ts', './symptoms/**/*.ts', './enemies/**/*.ts', './statuses/**/*.ts', './relics/**/*.ts', './domains/**/*.ts', './encounters/**/*.ts', './motifs/**/*.ts', './events/**/*.ts', '!**/*.test.ts'],
    { eager: true },
  ),
);
