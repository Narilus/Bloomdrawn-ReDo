import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import { evaluate, formulaSchema, formulaText, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import type { CombatState } from '../state.ts';
import { getOp } from './index.ts';

export type Condition = { gte: [Formula, Formula] };

export interface WhenArgs extends OpCall {
  op: 'when';
  condition: Condition;
  branch: OpCall[];
}

export const gte = (a: Formula, b: Formula): Condition => ({ gte: [a, b] });

/** Resolves the branch only if the condition holds when this operation resolves. */
export const when = (condition: Condition, branch: OpCall[]): WhenArgs => ({ op: 'when', condition, branch });

const holds = (state: CombatState, { gte: [a, b] }: Condition, ctx: OpContext, registry: Registry) =>
  evaluate(a, state, ctx, registry) >= evaluate(b, state, ctx, registry);

export const whenOp: Operation<WhenArgs> = {
  args: z.strictObject({
    op: z.literal('when'),
    condition: z.strictObject({ gte: z.tuple([formulaSchema, formulaSchema]) }),
    branch: z.array(z.looseObject({ op: z.string() })).min(1),
  }),
  resolve: (draft, args, ctx, registry) =>
    holds(draft, args.condition, ctx, registry) ? { events: [], then: args.branch } : { events: [] },
  preview: (state, args, ctx, registry) => [{ op: 'when', resolves: holds(state, args.condition, ctx, registry) }],
  describe(args, show, registry) {
    const [a, b] = args.condition.gte;
    const branch = args.branch.map((call) => {
      const text = getOp(registry, call.op)?.describe(call, show, registry) ?? call.op;
      return text.charAt(0).toLowerCase() + text.slice(1);
    });
    return `If ${formulaText(a)} is ${show(b)} or more: ${branch.join(', ')}`;
  },
  children: (args) => args.branch,
};
