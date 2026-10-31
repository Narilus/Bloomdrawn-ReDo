import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { STARTER_PARTY } from '../content/testing/scenario.ts';
import { startCombat } from '../engine/index.ts';
import { enemyBox, enemyHeight, enemyHome, enemyUnder } from './layout.ts';

const SIZES = ['small', 'normal', 'large', 'huge'] as const;
const overlap = (a: ReturnType<typeof enemyBox>, b: ReturnType<typeof enemyBox>) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('enemy layout', () => {
  it('in a three-slot fight no two target areas overlap, whatever the sizes, so a flank tucked behind the anchor stays aimable', () => {
    for (const a of SIZES)
      for (const b of SIZES)
        for (const [i, j] of [
          [0, 1],
          [0, 2],
          [1, 2],
        ] as const)
          expect(overlap(enemyBox(enemyHome(i, 3)!, enemyHeight(a)), enemyBox(enemyHome(j, 3)!, enemyHeight(b))), `${a} ${i}, ${b} ${j}`).toBe(false);
  });

  it('where target areas overlap, aims at the enemy drawn in front', () => {
    const bodies = [1, 0].map((slot) => ({ id: slot, home: enemyHome(slot, 4)!, height: enemyHeight('normal') }));
    // Slots 0 and 1 of four overlap here; slot 0 stands lower, so in front.
    expect(enemyUnder({ x: 1320, y: 600 }, bodies)).toBe(0);
    expect(enemyUnder({ x: 1500, y: 400 }, bodies)).toBe(1);
    expect(enemyUnder({ x: 100, y: 100 }, bodies)).toBeNull();
  });

  it('in every three-slot fight the anchor is taller than anything that can stand beside it, summons included', () => {
    for (const [id, encounter] of Object.entries(registry.encounters)) {
      const state = startCombat({ seed: 1, party: STARTER_PARTY, enemies: encounter.enemies }, registry).state;
      if (state.enemySlots !== 3) continue;
      const [anchor, ...flanks] = state.enemies.map((e) => e.enemy);
      const def = registry.enemies[anchor!]!;
      const intents = [...(def.intents ?? []), ...(def.phases ?? []).flatMap((p) => [p.rouse, ...p.intents])];
      const summoned = intents.flatMap((i) => i.effects).flatMap((call) => ('enemy' in call && call.op === 'summon' ? [String(call.enemy)] : []));
      const height = (enemy: string) => enemyHeight(registry.enemies[enemy]?.size);
      for (const flank of [...flanks, ...summoned]) expect(height(flank), `${flank} beside ${anchor} in ${id}`).toBeLessThan(height(anchor!));
    }
  });
});
