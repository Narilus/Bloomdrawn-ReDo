import { z } from 'zod';
import { resourceDef } from '../resources.ts';
import type { OpCall, Registry } from '../defs.ts';
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

/** A count is gained whole; a stored amount (potency) exactly, filled from the source's Attack as it resolves and never recomputed. */
const gained = (args: GainResourceArgs, value: number, registry: Registry) =>
  Math.max(0, resourceDef(registry, args.resource)?.amount ? value : Math.floor(value));

export const gainResourceOp: Operation<GainResourceArgs> = {
  args: z.strictObject({ op: z.literal('gainResource'), resource: z.string().min(1), amount: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    const amount = gained(args, evaluate(args.amount, draft, ctx, registry), registry);
    draft.resources[args.resource] = (draft.resources[args.resource] ?? 0) + amount;
    const event = { type: 'resourceGained' as const, source: ctx.source, resource: args.resource, amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview: (state, args, ctx, registry) => [
    {
      op: 'gainResource',
      resource: args.resource,
      amount: gained(args, evaluate(args.amount, state, ctx, registry), registry),
    },
  ],
  describe: (args, show) => `Gain ${show(args.amount)} ${titleCase(args.resource)}`,
};
