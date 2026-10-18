import { describe, expect, it } from 'vitest';
import { formulaText } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { gainMana, gainManaOp } from './gainMana.ts';
import { manaDebt, manaDebtOp } from './manaDebt.ts';

const ctx = { source: 'm3', owner: 'm3' };

describe('gainMana and manaDebt', () => {
  it('gainMana adds Mana now, past the maximum', () => {
    const state = fixtureCombat();
    const { events } = gainManaOp.resolve(state, gainMana(4), ctx, registry);
    expect(state.mana).toBe(10);
    expect(events).toEqual([{ type: 'resourceGained', source: 'm3', owner: 'm3', resource: 'mana', amount: 4 }]);
  });

  it('manaDebt records debt for the next refill without touching Mana now', () => {
    const state = fixtureCombat();
    manaDebtOp.resolve(state, manaDebt(2), ctx, registry);
    manaDebtOp.resolve(state, manaDebt(3), ctx, registry);
    expect([state.mana, state.manaDebt]).toEqual([6, 5]);
  });

  it('describe themselves', () => {
    expect(gainManaOp.describe(gainMana(4), formulaText, registry)).toBe('Gain 4 Mana');
    expect(manaDebtOp.describe(manaDebt(2), formulaText, registry)).toBe('Take 2 Mana debt');
  });
});
