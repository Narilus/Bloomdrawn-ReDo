import { z } from 'zod';
import type { Keyword, OpCall } from '../defs.ts';
import { evaluate, formulaSchema, hasKeyword, titleCase, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';

export interface ChangeCostArgs extends OpCall {
  op: 'changeCost';
  /** Negative makes cards cheaper. */
  amount: Formula;
  /** `hand`: cards in hand now, optionally only those with a keyword. `next`: the next card played this turn. */
  cards: 'hand' | 'next';
  keyword?: Keyword;
}

export const changeCost = (amount: Formula, cards: 'hand' | 'next', keyword?: Keyword): ChangeCostArgs => ({
  op: 'changeCost',
  amount,
  cards,
  ...(keyword ? { keyword } : {}),
});

export const changeCostOp: Operation<ChangeCostArgs> = {
  args: z.strictObject({
    op: z.literal('changeCost'),
    amount: formulaSchema,
    cards: z.enum(['hand', 'next']),
    keyword: z.enum(['retain', 'ritual']).optional(),
  }),
  resolve(draft, args, ctx, registry) {
    const amount = Math.trunc(evaluate(args.amount, draft, ctx, registry));
    if (args.cards === 'next') {
      draft.next.costDelta += amount;
      return { events: [] };
    }
    for (const card of draft.piles.hand) {
      const def = registry.cards[card.card];
      if (!def || (args.keyword && !hasKeyword(def.keywords, args.keyword))) continue;
      // Costs bottom out at 0; a discount past 0 is not banked against later increases.
      card.costDelta = Math.max(-def.cost, (card.costDelta ?? 0) + amount);
    }
    return { events: [] };
  },
  preview: (state, args, ctx, registry) => [{ op: 'changeCost', amount: Math.trunc(evaluate(args.amount, state, ctx, registry)) }],
  describe(args, show) {
    const negative = typeof args.amount === 'number' && args.amount < 0;
    const amount = negative ? show(-(args.amount as number)) : show(args.amount);
    const change = negative ? `costs ${amount} less` : `costs ${amount} more`;
    if (args.cards === 'next') return `The next card you play this turn ${change}`;
    return `Every ${args.keyword ? titleCase(args.keyword) : 'card'} in your hand ${change}`;
  },
};
