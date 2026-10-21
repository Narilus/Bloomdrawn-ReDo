import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';

export interface DrawFewerArgs extends OpCall {
  op: 'drawFewer';
  count: Formula;
}

/** The start of next turn draws this many fewer cards. */
export const drawFewer = (count: Formula): DrawFewerArgs => ({ op: 'drawFewer', count });

const countOf = (...args: Parameters<typeof evaluate>) => Math.max(0, Math.floor(evaluate(...args)));

export const drawFewerOp: Operation<DrawFewerArgs> = {
  args: z.strictObject({ op: z.literal('drawFewer'), count: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    draft.drawFewer = (draft.drawFewer ?? 0) + countOf(args.count, draft, ctx, registry);
    return { events: [] };
  },
  preview: (state, args, ctx, registry) => [{ op: 'drawFewer', amount: countOf(args.count, state, ctx, registry) }],
  describe(args, show) {
    const count = show(args.count);
    return `Next turn, draw ${count} fewer card${count === '1' ? '' : 's'}`;
  },
};
