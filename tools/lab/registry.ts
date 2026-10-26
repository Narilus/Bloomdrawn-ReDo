import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Registry } from '../../src/engine/index.ts';
import { buildRegistry, CONTENT_FOLDERS } from '../../src/content/validate.ts';

// The game's content registry built in plain Node: the same folders registry.ts globs in Vite.

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : [],
  );

export async function loadRegistry(): Promise<Registry> {
  const modules: Record<string, Record<string, unknown>> = {};
  for (const folder of CONTENT_FOLDERS) {
    for (const file of files(join(CONTENT, folder))) {
      modules[`./${relative(CONTENT, file)}`] = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    }
  }
  return buildRegistry(modules);
}
