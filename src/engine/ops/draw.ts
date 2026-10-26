import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';
import { drawCards } from '../piles.ts';

export interface DrawArgs extends OpCall {
  op: 'draw';
  count: Formula;
}

export const draw = (count: Formula): DrawArgs => ({ op: 'draw', count });

export const drawOp: Operation<DrawArgs> = {
  args: z.strictObject({ op: z.literal('draw'), count: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    const count = Math.max(0, Math.floor(evaluate(args.count, draft, ctx, registry)));
    return { events: drawCards(draft, count, ctx.source) };
  },
  preview: (state, args, ctx, registry) => [
    { op: 'draw', amount: Math.max(0, Math.floor(evaluate(args.count, state, ctx, registry))) },
  ],
  describe(args, show) {
    const count = show(args.count);
    // A shown number may come marked up for the card face, so a plain count decides the plural.
    const one = typeof args.count === 'number' ? args.count === 1 : count === '1';
    return `Draw ${count} card${one ? '' : 's'}`;
  },
};
