import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation } from '../operation.ts';

export interface ManaDebtArgs extends OpCall {
  op: 'manaDebt';
  amount: Formula;
}

/** Debt is taken off the next turn's refill (see beginTurn). */
export const manaDebt = (amount: Formula): ManaDebtArgs => ({ op: 'manaDebt', amount });

export const manaDebtOp: Operation<ManaDebtArgs> = {
  args: z.strictObject({ op: z.literal('manaDebt'), amount: formulaSchema }),
  resolve(draft, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    draft.manaDebt += amount;
    const event = { type: 'resourceGained' as const, source: ctx.source, resource: 'manaDebt', amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview: (state, args, ctx, registry) => [
    { op: 'manaDebt', resource: 'manaDebt', amount: Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry))) },
  ],
  describe: (args, show) => `Take ${show(args.amount)} Mana debt`,
};
