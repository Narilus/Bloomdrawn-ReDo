import { describe, expect, it } from 'vitest';
import { formulaText } from '../formula.ts';
import { HAND_MAX } from '../state.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { draw, drawOp } from './draw.ts';

const ctx = { source: 'm0', owner: 'm0' };

describe('draw', () => {
  it('draws from the top of the draw pile, and preview matches', () => {
    const draft = fixtureCombat();
    const top = draft.piles.draw.slice(0, 2).map((c) => c.uid);
    expect(drawOp.preview(draft, draw(2), ctx, registry)).toEqual([{ op: 'draw', amount: 2 }]);
    const { events } = drawOp.resolve(draft, draw(2), ctx, registry);
    expect(draft.piles.hand.slice(-2).map((c) => c.uid)).toEqual(top);
    expect(events.map((e) => [e.type, e.card])).toEqual(top.map((uid) => ['cardDrawn', uid]));
  });

  it('reshuffles the discard pile only when a draw needs it', () => {
    const draft = fixtureCombat();
    draft.piles.discard = draft.piles.draw.splice(1);
    const { events } = drawOp.resolve(draft, draw(3), ctx, registry);
    expect(events.map((e) => e.type)).toEqual(['cardDrawn', 'deckShuffled', 'cardDrawn', 'cardDrawn']);
    expect(draft.piles.discard).toHaveLength(0);
    expect(draft.piles.hand).toHaveLength(8);
  });

  it(`stops at the hand maximum of ${HAND_MAX}; the rest stay in the deck`, () => {
    const draft = fixtureCombat();
    const deck = draft.piles.draw.length;
    drawOp.resolve(draft, draw(9), ctx, registry);
    expect(draft.piles.hand).toHaveLength(HAND_MAX);
    expect(draft.piles.draw).toHaveLength(deck - (HAND_MAX - 5));
  });

  it('describes itself', () => {
    expect(drawOp.describe(draw(1), formulaText, registry)).toBe('Draw 1 card');
    expect(drawOp.describe(draw(2), formulaText, registry)).toBe('Draw 2 cards');
    // A card face marks its live numbers up; the plural still follows the count.
    expect(drawOp.describe(draw(1), (f) => `<b>${formulaText(f)}</b>`, registry)).toBe('Draw <b>1</b> card');
  });
});
