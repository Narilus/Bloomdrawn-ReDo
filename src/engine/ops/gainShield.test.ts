import { describe, expect, it } from 'vitest';
import { add, formulaText, stat } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { gainShield, gainShieldOp } from './gainShield.ts';

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

  it('describes itself', () => {
    expect(gainShieldOp.describe(defend, formulaText, registry)).toBe('Gain 5 + Defense Shield');
  });
});
