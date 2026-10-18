import { describe, expect, it } from 'vitest';
import { apply } from '../combat.ts';
import { formulaText, resource } from '../formula.ts';
import { previewCard } from '../preview.ts';
import { fixtureCombat, withCardInHand, withCards } from '../testing/fixtures.ts';
import { draw } from './draw.ts';
import { gainResource } from './gainResource.ts';
import { gte, when, whenOp } from './when.ts';

const choir = {
  id: 'test.a.choir', name: 'Choir', owner: 'test.a', cost: 0, target: 'none' as const,
  effects: [gainResource('tentacles', 2), when(gte(resource('tentacles'), 4), [draw(1)])],
};
const registry = withCards(choir);

function play(tentacles: number) {
  const start = fixtureCombat(['test.dummy'], [], registry);
  start.resources['tentacles'] = tentacles;
  const [state, card] = withCardInHand(start, choir.id);
  const command = { type: 'playCard' as const, card: card.uid };
  const preview = previewCard(state, command, registry);
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return { preview, state: result.state };
}

describe('when', () => {
  it('checks its condition when it resolves, after earlier operations', () => {
    expect(play(2).state.piles.hand).toHaveLength(6);
    expect(play(1).state.piles.hand).toHaveLength(5);
  });

  it('previews whether the branch resolves and what it does', () => {
    expect(play(2).preview?.at(-1)).toEqual({ op: 'when', resolves: true, branch: [{ op: 'draw', amount: 1 }] });
    expect(play(1).preview?.at(-1)).toEqual({ op: 'when', resolves: false });
  });

  it('describes itself', () => {
    expect(whenOp.describe(when(gte(resource('tentacles'), 4), [draw(1)]), formulaText, registry)).toBe(
      'If Tentacles is 4 or more: draw 1 card',
    );
  });
});
