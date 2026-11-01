import { describe, expect, it } from 'vitest';
import { add, formulaText, stat } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { gainShield, gainShieldOp } from './gainShield.ts';
import { summon } from './summon.ts';
import type { Registry } from '../defs.ts';

const defend = gainShield(add(5, stat('defense')));

describe('gainShield', () => {
  it('a party member shields the shared pool with base + Defense, and preview matches', () => {
    const state = fixtureCombat();
    const ctx = { source: 'm1', owner: 'm1' };
    const draft = structuredClone(state);
    const { events } = gainShieldOp.resolve(draft, defend, ctx, registry);
    expect(gainShieldOp.preview(state, defend, ctx, registry)).toEqual([{ op: 'gainShield', target: 'party', amount: 7 }]);
    expect(draft.party.shield).toBe(7);
    expect(events).toEqual([{ type: 'shieldGained', source: 'm1', owner: 'm1', target: 'party', amount: 7 }]);
  });

  it('applies outgoing Shield multipliers', () => {
    const state = fixtureCombat(['test.dummy'], ['test.double-shield']);
    expect(gainShieldOp.preview(state, defend, { source: 'm0', owner: 'm0' }, registry)[0]?.amount).toBe(14);
  });

  it('an enemy shields itself', () => {
    const draft = fixtureCombat();
    gainShieldOp.resolve(draft, gainShield(6), { source: 'e20' }, registry);
    expect(draft.enemies[0]?.shield).toBe(6);
    expect(draft.party.shield).toBe(0);
  });

  it("an enemy shields the ally with the lowest HP, or with the most max HP, itself included", () => {
    const state = fixtureCombat(['test.dummy', 'test.dummy', 'test.dummy']);
    Object.assign(state.enemies[0]!, { hp: 20, maxHp: 30 });
    Object.assign(state.enemies[1]!, { hp: 10, maxHp: 40 });
    Object.assign(state.enemies[2]!, { hp: 0, maxHp: 90 });
    const shields = (target: 'lowestAlly' | 'largestAlly', source: string) => {
      const draft = structuredClone(state);
      gainShieldOp.resolve(draft, gainShield(6, target), { source }, registry);
      return draft.enemies.map((e) => e.shield);
    };
    // The third is dead, so it holds nothing whatever its max HP.
    expect(shields('lowestAlly', state.enemies[0]!.id)).toEqual([0, 6, 0]);
    expect(shields('largestAlly', state.enemies[0]!.id)).toEqual([0, 6, 0]);
    state.enemies[1]!.maxHp = 30;
    expect(shields('largestAlly', state.enemies[1]!.id)).toEqual([6, 0, 0]);
  });

  it('an enemy shields where its heal would go: a hurt ally first, by share of HP missing, else itself', () => {
    const state = fixtureCombat(['test.dummy', 'test.dummy', 'test.dummy']);
    const shields = () => {
      const draft = structuredClone(state);
      gainShieldOp.resolve(draft, gainShield(6, 'leaderFirst'), { source: state.enemies[0]!.id }, registry);
      return draft.enemies.map((e) => e.shield);
    };
    expect(shields()).toEqual([6, 0, 0]);
    state.enemies[0]!.hp = 5;
    expect(shields()).toEqual([6, 0, 0]);
    state.enemies[2]!.hp = 30;
    expect(shields()).toEqual([0, 0, 6]);
  });

  it('an add shields the ally that leads it, a Boss or a summoner, hurt or not, else itself (a Trial\'s Marionettes)', () => {
    const withCaller: Registry = {
      ...registry,
      enemies: { ...registry.enemies, 'test.caller': { id: 'test.caller', name: 'Caller', hp: 100, intents: [{ id: 'call', name: 'Call', effects: [summon({ id: 'test.frail' }, 1, 1)] }] } },
    };
    const bow = gainShield(6, 'leader');
    const shields = (enemies: string[]) => {
      const draft = fixtureCombat(enemies, [], withCaller);
      gainShieldOp.resolve(draft, bow, { source: draft.enemies[0]!.id }, withCaller);
      return draft.enemies.map((e) => e.shield);
    };
    expect(shields(['test.dummy', 'test.caller'])).toEqual([0, 6]);
    expect(shields(['test.dummy', 'test.dummy'])).toEqual([6, 0]);
    expect(gainShieldOp.describe(bow, formulaText, withCaller)).toBe('Its leader gains 6 Shield');
  });

  it('describes itself', () => {
    expect(gainShieldOp.describe(defend, formulaText, registry)).toBe('Gain 5 + Defense Shield');
  });
});
