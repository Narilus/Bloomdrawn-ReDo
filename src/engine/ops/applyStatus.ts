import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, type CombatState, type EntityId, type StatusStack } from '../state.ts';

export interface ApplyStatusArgs extends OpCall {
  op: 'applyStatus';
  status: string;
  stacks: Formula;
  /** `chosen`: the command's target. `self`: the source itself. */
  target?: 'chosen' | 'self';
}

export const applyStatus = (
  status: { id: string },
  stacks: Formula,
  target: ApplyStatusArgs['target'] = 'chosen',
): ApplyStatusArgs => ({ op: 'applyStatus', status: status.id, stacks, target });

function bearer(state: CombatState, args: ApplyStatusArgs, ctx: OpContext): { id: EntityId; statuses: StatusStack[] } | undefined {
  const id = args.target === 'self' ? ctx.source : ctx.target;
  const member = state.members.find((m) => m.id === id);
  if (member) return member;
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy && isAlive(enemy) ? enemy : undefined;
}

export const applyStatusOp: Operation<ApplyStatusArgs> = {
  args: z.strictObject({
    op: z.literal('applyStatus'),
    status: z.string().min(1),
    stacks: formulaSchema,
    target: z.enum(['chosen', 'self']).optional(),
  }),
  validate: (state, args, ctx) => (bearer(state, args, ctx) ? undefined : 'No one can bear this status.'),
  resolve(draft, args, ctx, registry) {
    const who = bearer(draft, args, ctx);
    const def = registry.statuses[args.status];
    if (!who || !def) return { events: [] };
    const stacks = Math.max(0, Math.floor(evaluate(args.stacks, draft, ctx, registry)));
    const existing = who.statuses.find((s) => s.status === args.status);
    if (!existing) who.statuses.push({ status: args.status, stacks });
    else if (def.stacking === 'add') existing.stacks += stacks;
    else if (def.stacking === 'refresh') existing.stacks = stacks;
    else existing.stacks = Math.max(existing.stacks, stacks);
    return { events: [{ type: 'statusApplied', source: ctx.source, target: who.id, status: args.status, amount: stacks }] };
  },
  preview(state, args, ctx, registry) {
    const who = bearer(state, args, ctx);
    if (!who) return [];
    const amount = Math.max(0, Math.floor(evaluate(args.stacks, state, ctx, registry)));
    return [{ op: 'applyStatus', target: who.id, status: args.status, amount }];
  },
  describe: (args, show) => `Apply ${show(args.stacks)} ${titleCase(args.status.replace(/^status\./, ''))}`,
};
