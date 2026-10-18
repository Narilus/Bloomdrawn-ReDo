import { describe, expect, it } from 'vitest';
import { formulaText } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { heal, healOp } from './heal.ts';

describe('heal', () => {
  it("heals the source's side, never past max HP, and preview matches", () => {
    const state = fixtureCombat();
    state.party.hp = 70;
    expect(healOp.preview(state, heal(15), { source: 'm1' }, registry)).toEqual([{ op: 'heal', target: 'party', amount: 10 }]);
    const { events } = healOp.resolve(state, heal(15), { source: 'm1', owner: 'm1' }, registry);
    expect(state.party.hp).toBe(80);
    expect(events).toEqual([{ type: 'healed', source: 'm1', owner: 'm1', target: 'party', amount: 10 }]);
    const enemy = state.enemies[0]!;
    enemy.hp = 30;
    healOp.resolve(state, heal(4), { source: enemy.id }, registry);
    expect(enemy.hp).toBe(34);
  });

  it('describes itself', () => {
    expect(healOp.describe(heal(3), formulaText, registry)).toBe('Heal 3');
  });
});
