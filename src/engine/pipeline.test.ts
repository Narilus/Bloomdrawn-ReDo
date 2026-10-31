import { describe, expect, it } from 'vitest';
import type { Registry } from './defs.ts';
import { pipeline } from './modifiers.ts';
import { damage } from './ops/damage.ts';
import { fixtureCombat, fixtureRegistry } from './testing/fixtures.ts';

// The pipeline rounds once, at the end (docs/notes/m6-scaling.md, 4.7; owner, 31 Oct): a % effect is
// never eaten by rounding each step.

const registry: Registry = {
  ...fixtureRegistry,
  relics: { ...fixtureRegistry.relics, 'test.plus15': { id: 'test.plus15', modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 1.15 }] } },
};

describe('the modifier pipeline', () => {
  it("a 15% bonus on a 12-damage hit isn't lost to step rounding", () => {
    const state = fixtureCombat(['test.dummy'], ['test.plus15'], registry);
    const ctx = { source: 'm0', owner: 'm0' };
    // 12 × 1.15 is 13.8: 13.
    expect(pipeline('damage', 12, state, ctx, registry)).toBe(13);
    // With the target exposed (× 1.5), 12 × 1.15 × 1.5 is 20.7: 20, where rounding each step gave 13 × 1.5 = 19.
    const enemy = state.enemies[0]!;
    const exposed = { ...state, enemies: [{ ...enemy, statuses: [{ status: 'test.exposed', stacks: 1 }] }] };
    expect(pipeline('damage', 12, exposed, ctx, registry, enemy.id)).toBe(20);
  });

  it('carries fractions from the formula itself through to the end', () => {
    const state = fixtureCombat();
    const enemy = state.enemies[0]!;
    const exposed = { ...state, enemies: [{ ...enemy, statuses: [{ status: 'test.exposed', stacks: 1 }] }] };
    // 250% of Attack 3 is 7.5; exposed (× 1.5), 11.25: 11. Rounding the formula first gave 7 × 1.5 = 10.
    expect(pipeline('damage', damage({ mul: [2.5, { stat: 'attack' }] }).amount, exposed, { source: 'm0', owner: 'm0' }, registry, enemy.id)).toBe(11);
  });

  it('a product whole on paper stays whole despite floating-point error', () => {
    const state = fixtureCombat();
    // 0.7 × 30 is 20.999999999999996 in floating point.
    expect(pipeline('damage', { mul: [0.7, 30] }, state, { source: 'm0', owner: 'm0' }, registry)).toBe(21);
  });
});
