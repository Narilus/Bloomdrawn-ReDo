import { describe, expect, it } from 'vitest';
import type { Registry } from '../defs.ts';
import { startCombat } from '../combat.ts';
import { fixtureCombat, fixtureRegistry, STARTERS } from '../testing/fixtures.ts';
import { summon, summonOp } from './summon.ts';

const registry: Registry = {
  ...fixtureRegistry,
  enemies: {
    ...fixtureRegistry.enemies,
    'test.sower': { id: 'test.sower', name: 'Sower', hp: 100 },
    'test.seed': { id: 'test.seed', name: 'Seed', hp: 10, intents: [{ id: 'wait', name: 'Wait', effects: [] }] },
    'test.caller': { id: 'test.caller', name: 'Caller', hp: 100, intents: [{ id: 'call', name: 'Call', effects: [summon({ id: 'test.seed' }, 1, 3)] }] },
    'test.warden': { id: 'test.warden', name: 'Warden', hp: 10, traits: ['resistsControl'], intents: [{ id: 'wait', name: 'Wait', effects: [] }] },
  },
  statuses: {
    ...fixtureRegistry.statuses,
    'test.delay': { id: 'test.delay', stacking: 'highest', skipsAction: 'hold', resistedAs: 'test.falter' },
    'test.falter': { id: 'test.falter', stacking: 'highest', endsAfterAction: true },
  },
};

describe('summon with a stagger', () => {
  it('each arrival after the first comes with one stack of the status', () => {
    const state = fixtureCombat(['test.sower'], [], registry);
    state.enemySlots = 4;
    const { events } = summonOp.resolve(state, summon({ id: 'test.seed' }, 3, 3, { id: 'test.delay' }), { source: state.enemies[0]!.id }, registry);
    expect(state.enemies.slice(1).map((e) => e.statuses)).toEqual([[], [{ status: 'test.delay', stacks: 1 }], [{ status: 'test.delay', stacks: 1 }]]);
    expect(events.filter((e) => e.type === 'statusApplied').map((e) => e.target)).toEqual([state.enemies[2]!.id, state.enemies[3]!.id]);
  });

  it('an arrival that resists control takes the resisted form', () => {
    const state = fixtureCombat(['test.sower'], [], registry);
    state.enemySlots = 3;
    summonOp.resolve(state, summon({ id: 'test.warden' }, 2, 2, { id: 'test.delay' }), { source: state.enemies[0]!.id }, registry);
    expect(state.enemies[2]!.statuses).toEqual([{ status: 'test.falter', stacks: 1 }]);
  });

  it('without one, every arrival comes bare', () => {
    const state = fixtureCombat(['test.sower'], [], registry);
    state.enemySlots = 3;
    summonOp.resolve(state, summon({ id: 'test.seed' }, 2, 2), { source: state.enemies[0]!.id }, registry);
    expect(state.enemies.slice(1).map((e) => e.statuses)).toEqual([[], []]);
    expect(summon({ id: 'test.seed' }, 2, 2)).not.toHaveProperty('stagger');
  });
});

describe('a summoner placed by its encounter entry', () => {
  const begin = (enemies: Parameters<typeof startCombat>[0]['enemies']) => startCombat({ seed: 1, party: STARTERS, enemies }, registry).state;

  it('stands in its own slot, and its summons fill the free slots front first', () => {
    const state = begin([{ enemy: 'test.caller', slot: 1 }]);
    expect([state.enemySlots, state.enemies[0]!.slot]).toEqual([4, 1]);
    summonOp.resolve(state, summon({ id: 'test.seed' }, 3, 3), { source: state.enemies[0]!.id }, registry);
    expect(state.enemies.map((e) => e.slot)).toEqual([1, 0, 2, 3]);
  });

  it("refuses a slot past the fight's, or two enemies in one", () => {
    expect(() => begin([{ enemy: 'test.caller', slot: 4 }])).toThrow("Enemy slot 4 is past the fight's 4");
    expect(() => begin(['test.caller', { enemy: 'test.sower', slot: 0 }])).toThrow('Two enemies start in one slot');
  });
});
