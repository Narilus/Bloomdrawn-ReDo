import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';

export interface GainManaArgs extends OpCall {
  op: 'gainMana';
  amount: Formula;
}

export const gainMana = (amount: Formula): GainManaArgs => ({ op: 'gainMana', amount });

export const gainManaOp: Operation<GainManaArgs> = {
  args: z.strictObject({ op: z.literal('gainMana'), amount: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    draft.mana += amount;
    const event = { type: 'resourceGained' as const, source: ctx.source, resource: 'mana', amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview: (state, args, ctx, registry) => [
    { op: 'gainMana', resource: 'mana', amount: Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry))) },
  ],
  describe: (args, show) => `Gain ${show(args.amount)} Mana`,
};
