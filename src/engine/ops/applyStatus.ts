import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, type CombatState, type EntityId, type StatusStack } from '../state.ts';

export interface ApplyStatusArgs extends OpCall {
  op: 'applyStatus';
  status: string;
  stacks: Formula;
  /** `chosen`: the command's target. `self`: the source itself. `allEnemies`: every living enemy. */
  target?: 'chosen' | 'self' | 'allEnemies';
}

export const applyStatus = (
  status: { id: string },
  stacks: Formula,
  target: ApplyStatusArgs['target'] = 'chosen',
): ApplyStatusArgs => ({ op: 'applyStatus', status: status.id, stacks, target });

function bearers(state: CombatState, args: ApplyStatusArgs, ctx: OpContext): { id: EntityId; statuses: StatusStack[] }[] {
  if (args.target === 'allEnemies') return state.enemies.filter(isAlive);
  const id = args.target === 'self' ? ctx.source : ctx.target;
  const member = state.members.find((m) => m.id === id);
  if (member) return [member];
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy && isAlive(enemy) ? [enemy] : [];
}

export const applyStatusOp: Operation<ApplyStatusArgs> = {
  args: z.strictObject({
    op: z.literal('applyStatus'),
    status: z.string().min(1),
    stacks: formulaSchema,
    target: z.enum(['chosen', 'self', 'allEnemies']).optional(),
  }),
  validate: (state, args, ctx) => (bearers(state, args, ctx).length > 0 ? undefined : 'No one can bear this status.'),
  resolve(draft, args, ctx, registry) {
    const def = registry.statuses[args.status];
    if (!def) return { events: [] };
    const stacks = Math.max(0, Math.floor(evaluate(args.stacks, draft, ctx, registry)));
    return {
      events: bearers(draft, args, ctx).map((who) => {
        const existing = who.statuses.find((s) => s.status === args.status);
        if (!existing) who.statuses.push({ status: args.status, stacks });
        else if (def.stacking === 'add') existing.stacks += stacks;
        else if (def.stacking === 'refresh') existing.stacks = stacks;
        else existing.stacks = Math.max(existing.stacks, stacks);
        return { type: 'statusApplied' as const, source: ctx.source, target: who.id, status: args.status, amount: stacks };
      }),
    };
  },
  preview(state, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.stacks, state, ctx, registry)));
    return bearers(state, args, ctx).map((who) => ({ op: 'applyStatus', target: who.id, status: args.status, amount }));
  },
  describe(args, show) {
    const text = `Apply ${show(args.stacks)} ${titleCase(args.status.replace(/^status\./, ''))}`;
    return args.target === 'allEnemies' ? `${text} to all enemies` : text;
  },
};
