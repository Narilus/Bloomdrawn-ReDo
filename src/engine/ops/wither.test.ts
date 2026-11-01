import { describe, expect, it } from 'vitest';
import type { Registry } from '../defs.ts';
import { fixtureCombat, fixtureRegistry } from '../testing/fixtures.ts';
import { foretell, foretellOp } from './foretell.ts';
import { wither, witherOp } from './wither.ts';

const registry: Registry = {
  ...fixtureRegistry,
  enemies: {
    ...fixtureRegistry.enemies,
    'test.husk': {
      id: 'test.husk', name: 'Husk', hp: 40,
      intents: [
        { id: 'harden', name: 'Harden', effects: [] },
        { id: 'ripen', name: 'Ripen', effects: [foretell()] },
        { id: 'burst', name: 'Burst', effects: [wither()] },
      ],
    },
  },
};

describe('wither', () => {
  it('the source loses all its HP through its Shield, and falls; preview matches', () => {
    const state = fixtureCombat(['test.husk', 'test.husk'], [], registry);
    const husk = state.enemies[0]!;
    husk.hp = 30;
    husk.shield = 50;
    expect(witherOp.preview(state, wither(), { source: husk.id }, registry)).toEqual([{ op: 'wither', target: husk.id, amount: 30 }]);
    const { events } = witherOp.resolve(state, wither(), { source: husk.id }, registry);
    expect(husk.hp).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['damageDealt', 'damageTaken', 'enemyDefeated']);
    expect(state.enemies[1]!.hp).toBe(40);
  });

  it('a rousing enemy does not wither', () => {
    const state = fixtureCombat(['test.husk'], [], registry);
    const husk = state.enemies[0]!;
    husk.rousing = true;
    expect(witherOp.resolve(state, wither(), { source: husk.id }, registry).events).toEqual([]);
    expect(husk.hp).toBe(40);
  });
});

describe('foretell', () => {
  it("names the source's next intent, wrapping to the first, and changes nothing", () => {
    const state = fixtureCombat(['test.husk'], [], registry);
    const husk = state.enemies[0]!;
    const next = () => foretellOp.preview(state, foretell(), { source: husk.id }, registry)[0]?.name;
    husk.intent = 1;
    expect(next()).toBe('Burst');
    husk.intent = 2;
    expect(next()).toBe('Harden');
    const before = structuredClone(state);
    expect(foretellOp.resolve(state, foretell(), { source: husk.id }, registry).events).toEqual([]);
    expect(state).toEqual(before);
  });
});
