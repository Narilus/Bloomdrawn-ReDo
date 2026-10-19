import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';
import { bearerOf, stacksOf, takeStacks } from '../statuses.ts';

export interface ReduceStacksArgs extends OpCall {
  op: 'reduceStacks';
  status: string;
  amount: Formula;
}

/** Removes stacks of a status from the source's side (its bearer, for a status's own triggers). At 0 it is gone. */
export const reduceStacks = (status: { id: string } | string, amount: Formula = 1): ReduceStacksArgs => ({
  op: 'reduceStacks',
  status: typeof status === 'string' ? status : status.id,
  amount,
});

export const reduceStacksOp: Operation<ReduceStacksArgs> = {
  args: z.strictObject({ op: z.literal('reduceStacks'), status: z.string().min(1), amount: formulaSchema }),
  validate: (state, args, ctx, registry) => {
    const bearer = bearerOf(state, ctx.source, registry);
    return bearer && stacksOf(bearer.statuses, args.status) > 0 ? undefined : 'No stacks to reduce.';
  },
  resolve(draft, args, ctx, registry) {
    const bearer = bearerOf(draft, ctx.source, registry);
    if (!bearer) return { events: [] };
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    if (!takeStacks(bearer.statuses, args.status, amount)) return { events: [] };
    const removed: EngineEvent = { type: 'statusRemoved', source: ctx.source, target: bearer.id, status: args.status };
    return { events: [removed] };
  },
  preview: (state, args, ctx, registry) => [
    { op: 'reduceStacks', status: args.status, amount: Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry))) },
  ],
  describe: (args, show) => `Remove ${show(args.amount)} ${titleCase(args.status.replace(/^status\./, ''))}`,
};
