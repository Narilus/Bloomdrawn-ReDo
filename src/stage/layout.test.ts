import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { STARTER_PARTY } from '../content/testing/scenario.ts';
import { startCombat } from '../engine/index.ts';
import { enemyBox, enemyDepth, enemyHeight, enemyHome, enemyUnder } from './layout.ts';

const SIZES = ['small', 'normal', 'large', 'huge'] as const;
const overlap = (a: ReturnType<typeof enemyBox>, b: ReturnType<typeof enemyBox>) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('enemy layout', () => {
  it('in a three-slot fight no two target areas overlap, whatever the sizes, so a flank overlapping the anchor stays aimable', () => {
    for (const a of SIZES)
      for (const b of SIZES)
        for (const [i, j] of [
          [0, 1],
          [0, 2],
          [1, 2],
        ] as const)
          expect(overlap(enemyBox(enemyHome(i, 3)!, enemyHeight(a)), enemyBox(enemyHome(j, 3)!, enemyHeight(b))), `${a} ${i}, ${b} ${j}`).toBe(false);
  });

  it('draws smaller enemies in front of larger ones wherever they stand, so an add is never hidden behind its anchor; within a size, the one standing lower', () => {
    const [anchor, left, right] = [0, 1, 2].map((slot) => enemyHome(slot, 3)!);
    for (const [small, large] of [
      ['small', 'normal'],
      ['normal', 'large'],
      ['large', 'huge'],
    ] as const)
      for (const flank of [left!, right!]) expect(enemyDepth(flank, small), `${small} beside ${large}`).toBeGreaterThan(enemyDepth(anchor!, large));
    expect(enemyDepth(enemyHome(0, 4)!, 'normal')).toBeGreaterThan(enemyDepth(enemyHome(1, 4)!, 'normal'));
  });

  it('where target areas overlap, aims at the enemy drawn in front', () => {
    const [front, back] = [0, 1].map((slot) => enemyHome(slot, 4)!);
    // Slots 0 and 1 of four overlap here; at one size, slot 0 stands lower, so in front.
    const even = [
      { id: 'back', home: back!, size: 'normal' as const },
      { id: 'front', home: front!, size: 'normal' as const },
    ];
    expect(enemyUnder({ x: 1320, y: 600 }, even)).toBe('front');
    expect(enemyUnder({ x: 1500, y: 400 }, even)).toBe('back');
    expect(enemyUnder({ x: 100, y: 100 }, even)).toBeNull();
    // A smaller body standing further back is still drawn, and aimed, in front.
    const uneven = [
      { id: 'back', home: back!, size: 'normal' as const },
      { id: 'front', home: front!, size: 'large' as const },
    ];
    expect(enemyUnder({ x: 1320, y: 600 }, uneven)).toBe('back');
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
