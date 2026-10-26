import { expect, it } from 'vitest';
import { registry } from '../../src/content/registry.ts';
import { loadRegistry } from './registry.ts';

it("the lab builds the same registry as the game's", async () => {
  const lab = await loadRegistry();
  for (const family of Object.keys(registry) as (keyof typeof registry)[]) {
    expect(Object.keys(lab[family] ?? {}).sort(), family).toEqual(Object.keys(registry[family] ?? {}).sort());
  }
});
