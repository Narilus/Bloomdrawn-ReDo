import { describe, expect, it } from 'vitest';
import { formulaText, resource } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { volley, volleyOp } from './volley.ts';

const call = volley(resource('tentacles'), resource('potency'));
const ctx = { source: 'm0' };

/** Enemies in slot order with the given HP (and optional Shield). */
function combat(hps: number[], shields: number[] = []) {
  const state = fixtureCombat(hps.map(() => 'test.dummy'));
  state.enemies.forEach((e, i) => {
    e.hp = hps[i] as number;
    e.shield = shields[i] ?? 0;
  });
  return state;
}

describe('volley', () => {
  it('hits the lowest-HP enemy first, ties going to the earlier slot', () => {
    const state = combat([30, 12, 12]);
    Object.assign(state.resources, { tentacles: 2, potency: 5 });
    volleyOp.resolve(state, call, ctx, registry);
    expect(state.enemies.map((e) => e.hp)).toEqual([30, 2, 12]);
  });

  it('carries excess damage across enemies, lowest HP next', () => {
    const state = combat([40, 4, 9]);
    Object.assign(state.resources, { tentacles: 1, potency: 20 });
    const { events } = volleyOp.resolve(state, call, ctx, registry);
    // 4 kills the first, 9 kills the next, the last 7 lands on the 40.
    expect(state.enemies.map((e) => e.hp)).toEqual([33, 0, 0]);
    expect(events.filter((e) => e.type === 'damageDealt').map((e) => [e.target, e.amount])).toEqual([
      ['e21', 4],
      ['e22', 9],
      ['e20', 7],
    ]);
    expect(events.filter((e) => e.type === 'enemyDefeated').map((e) => e.target)).toEqual(['e21', 'e22']);
  });

  it('Shield absorbs first, and overflow is only what passes HP', () => {
    const state = combat([6, 30], [5, 0]);
    Object.assign(state.resources, { tentacles: 1, potency: 15 });
    volleyOp.resolve(state, call, ctx, registry);
    expect(state.enemies.map((e) => [e.hp, e.shield])).toEqual([[0, 0], [26, 0]]);
  });

  it('consumes no Tentacles, stops when every enemy is dead, and does nothing with none', () => {
    const state = combat([5]);
    Object.assign(state.resources, { tentacles: 4, potency: 3 });
    volleyOp.resolve(state, call, ctx, registry);
    expect(state.resources['tentacles']).toBe(4);
    expect(state.enemies[0]?.hp).toBe(0);
    state.resources['tentacles'] = 0;
    expect(volleyOp.resolve(combat([5]), call, ctx, registry).events).toEqual([]);
  });

  it('runs every hit through the modifier pipeline', () => {
    const state = fixtureCombat(['test.dummy'], ['test.plus3']);
    Object.assign(state.resources, { tentacles: 2, potency: 3 });
    volleyOp.resolve(state, call, ctx, registry);
    expect(state.enemies[0]?.hp).toBe(40 - 2 * 6);
  });

  it('preview lists every hit without changing state', () => {
    const state = combat([40, 4, 9]);
    Object.assign(state.resources, { tentacles: 1, potency: 20 });
    const before = structuredClone(state);
    expect(volleyOp.preview(state, call, ctx, registry).map((p) => [p.target, p.amount])).toEqual([
      ['e21', 4],
      ['e22', 9],
      ['e20', 7],
    ]);
    expect(state).toEqual(before);
  });

  it('describes itself', () => {
    expect(volleyOp.describe(call, formulaText, registry)).toBe('Volley: Tentacles hits of Potency damage');
  });
});
