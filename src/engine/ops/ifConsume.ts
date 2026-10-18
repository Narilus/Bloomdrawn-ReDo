import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import type { CombatState } from '../state.ts';
import { getOp } from './index.ts';

export interface IfConsumeArgs extends OpCall {
  op: 'ifConsume';
  resource: string;
  amount: Formula;
  branch: OpCall[];
}

/** Spend a resource for a bonus branch. Nothing is spent unless the whole branch can resolve. */
export const ifConsume = (resource: string, amount: Formula, branch: OpCall[]): IfConsumeArgs => ({
  op: 'ifConsume',
  resource,
  amount,
  branch,
});

function check(state: CombatState, args: IfConsumeArgs, ctx: OpContext, registry: Registry) {
  const need = Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));
  const enough = (state.resources[args.resource] ?? 0) >= need;
  const branchCtx = { ...ctx, consumed: need };
  const resolves =
    enough &&
    args.branch.every((call) => {
      const op = getOp(registry, call.op);
      return op !== undefined && op.validate?.(state, call, branchCtx, registry) === undefined;
    });
  return { need, resolves };
}

export const ifConsumeOp: Operation<IfConsumeArgs> = {
  args: z.strictObject({
    op: z.literal('ifConsume'),
    resource: z.string().min(1),
    amount: formulaSchema,
    branch: z.array(z.looseObject({ op: z.string() })).min(1),
  }),
  resolve(draft, args, ctx, registry) {
    const { need, resolves } = check(draft, args, ctx, registry);
    if (!resolves) return { events: [] };
    draft.resources[args.resource] = (draft.resources[args.resource] ?? 0) - need;
    const event = { type: 'resourceConsumed' as const, source: ctx.source, resource: args.resource, amount: need };
    return {
      events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }],
      then: args.branch,
      consumed: need,
    };
  },
  preview(state, args, ctx, registry) {
    const { need, resolves } = check(state, args, ctx, registry);
    return [{ op: 'ifConsume', resource: args.resource, amount: need, resolves }];
  },
  describe(args, show, registry) {
    const branch = args.branch.map((call) => {
      const text = getOp(registry, call.op)?.describe(call, show, registry) ?? call.op;
      return text.charAt(0).toLowerCase() + text.slice(1);
    });
    return `Consume ${show(args.amount)} ${titleCase(args.resource)}: ${branch.join(', ')}`;
  },
  children: (args) => args.branch,
};
