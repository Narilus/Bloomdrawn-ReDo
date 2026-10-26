import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import type { CombatState } from '../state.ts';
import { getOp } from './index.ts';

export interface RepeatArgs extends OpCall {
  op: 'repeat';
  times: Formula;
  branch: OpCall[];
}

/** Resolves the branch `times` times in a row (Thousand Cuts' hits). A pass that can't resolve fizzles, as a dead target's would. */
export const repeat = (times: Formula, branch: OpCall[]): RepeatArgs => ({ op: 'repeat', times, branch });

const timesOf = (args: RepeatArgs, state: CombatState, ctx: OpContext, registry: Registry) =>
  Math.max(0, Math.floor(evaluate(args.times, state, ctx, registry)));

export const repeatOp: Operation<RepeatArgs> = {
  args: z.strictObject({ op: z.literal('repeat'), times: formulaSchema, branch: z.array(z.looseObject({ op: z.string() })).min(1) }),
  resolve: (draft, args, ctx, registry) => ({ events: [], then: Array.from({ length: timesOf(args, draft, ctx, registry) }, () => args.branch).flat() }),
  preview: (state, args, ctx, registry) => [{ op: 'repeat', amount: timesOf(args, state, ctx, registry) }],
  describe(args, show, registry) {
    const branch = args.branch.map((call) => getOp(registry, call.op)?.describe(call, show, registry) ?? call.op);
    return `${show(args.times)} times: ${branch.map((t) => t.charAt(0).toLowerCase() + t.slice(1)).join(', ')}`;
  },
  children: (args) => args.branch,
};
