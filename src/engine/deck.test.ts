import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { CardDef } from './defs.ts';
import { evaluate, formulaText, percentOf } from './formula.ts';
import { drawFewer } from './ops/drawFewer.ts';
import { loseHp } from './ops/loseHp.ts';
import type { CombatState } from './state.ts';
import { fixtureCombat, STARTERS, testGain, withCardInHand, withCards } from './testing/fixtures.ts';

// The run's own deck and the engine pieces Symptoms need (docs/notes/m3-labyrinth.md "Engine needs").

const symptom: CardDef = { id: 'test.symptom', name: 'Symptom', cost: 0, target: 'none', effects: [testGain('symptom')] };
const graft: CardDef = { id: 'test.graft', name: 'Graft', cost: 0, target: 'none', effects: [drawFewer(1)] };
const fever: CardDef = { id: 'test.fever', name: 'Fever', cost: 0, target: 'none', effects: [loseHp(percentOf(4, 'hp'), { target: 'party' })] };
const registry = withCards(symptom, graft, fever);

function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
const endTurn: Command = { type: 'endTurn' };

describe("the run's own cards", () => {
  it('are dealt in with the personal cards, and the front member plays them', () => {
    const { state } = startCombat({ seed: 1, party: STARTERS, enemies: ['test.dummy'], deck: [{ card: 'test.symptom' }, { card: 'test.symptom' }] }, registry);
    const all = [...state.piles.draw, ...state.piles.hand];
    expect(all).toHaveLength(22);
    expect(all.filter((c) => c.card === 'test.symptom').map((c) => c.owner)).toEqual(['m0', 'm0']);
  });

  it('are played by the member who owns them, if they have an owner', () => {
    const deck = [{ card: 'test.symptom', owner: STARTERS[2]! }];
    const { state } = startCombat({ seed: 1, party: STARTERS, enemies: ['test.dummy'], deck }, registry);
    expect([...state.piles.draw, ...state.piles.hand].find((c) => c.card === 'test.symptom')?.owner).toBe('m2');
    expect(() => startCombat({ seed: 1, party: STARTERS.slice(0, 2), enemies: ['test.dummy'], deck }, registry)).toThrow(/not in the party/);
  });

  it('play like any card', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.symptom');
    expect(run(state, { type: 'playCard', card: card.uid }).resources['symptom']).toBe(1);
  });
});

describe('drawing fewer next turn', () => {
  it('takes cards off the next turn draw only', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.graft');
    const played = run(state, { type: 'playCard', card: card.uid });
    expect(played.piles.hand).toHaveLength(5);
    const next = run(played, endTurn);
    expect(next.piles.hand).toHaveLength(4);
    expect(run(next, endTurn).piles.hand).toHaveLength(5);
  });
});

describe('a share of party HP', () => {
  it("reads the party's current or max HP, and costs round down when an op uses them", () => {
    const state = fixtureCombat(['test.dummy'], [], registry);
    state.party.hp = 55;
    const ctx = { source: 'm0', owner: 'm0' };
    expect(evaluate(percentOf(4, 'hp'), state, ctx, registry)).toBeCloseTo(2.2);
    expect(evaluate(percentOf(10, 'maxHp'), state, ctx, registry)).toBe(8);
    const [withFever, card] = withCardInHand(state, 'test.fever');
    expect(run(withFever, { type: 'playCard', card: card.uid }).party.hp).toBe(53);
  });

  it('reads as a share when no numbers are live', () => {
    expect(formulaText(percentOf(4, 'hp'))).toBe("4% of the party's current HP");
    expect(formulaText(percentOf(1, 'maxHp'))).toBe("1% of the party's max HP");
  });
});
