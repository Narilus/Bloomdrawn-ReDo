import { describe, expect, it } from 'vitest';
import { apply, cardCost } from '../combat.ts';
import type { CardDef } from '../defs.ts';
import { formulaText } from '../formula.ts';
import { fixtureCombat, withCardInHand, withCards } from '../testing/fixtures.ts';
import { changeCost, changeCostOp } from './changeCost.ts';
import { gainResource } from './gainResource.ts';

const ritual: CardDef = { id: 'test.a.ritual', name: 'Ritual', owner: 'test.a', cost: 3, target: 'none', keywords: ['ritual'], effects: [gainResource('x', 1)] };
const plain: CardDef = { id: 'test.a.plain', name: 'Plain', owner: 'test.a', cost: 2, target: 'none', effects: [gainResource('x', 1)] };
const registry = withCards(ritual, plain);
const ctx = { source: 'm0', owner: 'm0' };

function hand() {
  const [a, r] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.ritual');
  const [state, p] = withCardInHand(a, 'test.a.plain');
  return { state, r, p };
}

describe('changeCost', () => {
  it('changes only cards with the keyword, and a Ritual bottoms out at 0', () => {
    const { state, r, p } = hand();
    const call = changeCost(-1, 'hand', 'ritual');
    const ritualIn = () => state.piles.hand.find((c) => c.uid === r.uid)!;
    changeCostOp.resolve(state, call, ctx, registry);
    expect([cardCost(state, ritualIn(), registry), cardCost(state, p, registry)]).toEqual([2, 2]);
    for (let i = 0; i < 4; i++) changeCostOp.resolve(state, call, ctx, registry);
    expect(cardCost(state, ritualIn(), registry)).toBe(0);
    // Discounts past 0 are not banked: one increase brings it straight back to 1.
    changeCostOp.resolve(state, changeCost(1, 'hand', 'ritual'), ctx, registry);
    expect(cardCost(state, ritualIn(), registry)).toBe(1);
  });

  it("a created copy's own cost and keywords are what it changes", () => {
    const { state, p } = hand();
    const copy = state.piles.hand.find((c) => c.uid === p.uid)!;
    Object.assign(copy, { cost: 0, keywords: ['ritual'] });
    changeCostOp.resolve(state, changeCost(-1, 'hand', 'ritual'), ctx, registry);
    changeCostOp.resolve(state, changeCost(1, 'hand', 'ritual'), ctx, registry);
    expect(cardCost(state, copy, registry)).toBe(1);
  });

  it('a next-card discount applies to the next card played, then is gone', () => {
    const { state, r, p } = hand();
    changeCostOp.resolve(state, changeCost(-2, 'next'), ctx, registry);
    expect([cardCost(state, r, registry), cardCost(state, p, registry)]).toEqual([1, 0]);
    const played = apply(state, { type: 'playCard', card: p.uid }, registry);
    if (!played.ok) throw new Error(played.reason);
    expect(played.state.mana).toBe(6);
    expect(cardCost(played.state, played.state.piles.hand.find((c) => c.uid === r.uid)!, registry)).toBe(3);
  });

  it('the discounted cost is what validation and payment use', () => {
    const { state, r } = hand();
    state.mana = 1;
    expect(apply(state, { type: 'playCard', card: r.uid }, registry).ok).toBe(false);
    changeCostOp.resolve(state, changeCost(-2, 'hand', 'ritual'), ctx, registry);
    const played = apply(state, { type: 'playCard', card: r.uid }, registry);
    expect(played.ok && played.state.mana).toBe(0);
  });

  it('a card loses its cost changes when it leaves the hand', () => {
    const { state, r } = hand();
    changeCostOp.resolve(state, changeCost(-2, 'hand'), ctx, registry);
    const played = apply(state, { type: 'playCard', card: r.uid }, registry);
    if (!played.ok) throw new Error(played.reason);
    expect(played.state.piles.discard.find((c) => c.uid === r.uid)).toEqual({ uid: r.uid, card: 'test.a.ritual', owner: 'm0' });
  });

  it('describes itself', () => {
    const d = (call: ReturnType<typeof changeCost>) => changeCostOp.describe(call, formulaText, registry);
    expect(d(changeCost(-1, 'hand', 'ritual'))).toBe('Every Ritual in your hand costs 1 less');
    expect(d(changeCost(-2, 'next'))).toBe('The next card you play this turn costs 2 less');
  });
});
