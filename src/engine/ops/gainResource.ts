import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';

export interface GainResourceArgs extends OpCall {
  op: 'gainResource';
  resource: string;
  amount: Formula;
}

export const gainResource = (resource: string, amount: Formula): GainResourceArgs => ({
  op: 'gainResource',
  resource,
  amount,
});

export const gainResourceOp: Operation<GainResourceArgs> = {
  args: z.strictObject({ op: z.literal('gainResource'), resource: z.string().min(1), amount: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    draft.resources[args.resource] = (draft.resources[args.resource] ?? 0) + amount;
    const event = { type: 'resourceGained' as const, source: ctx.source, resource: args.resource, amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview: (state, args, ctx, registry) => [
    {
      op: 'gainResource',
      resource: args.resource,
      amount: Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry))),
    },
  ],
  describe: (args, show) => `Gain ${show(args.amount)} ${titleCase(args.resource)}`,
};
