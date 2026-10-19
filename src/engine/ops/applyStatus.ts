import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, titleCase, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, type CombatState } from '../state.ts';
import { addStacks, bearerOf, landingStatus, type Bearer } from '../statuses.ts';
import type { Registry } from '../defs.ts';

export interface ApplyStatusArgs extends OpCall {
  op: 'applyStatus';
  status: string;
  stacks: Formula;
  /**
   * `chosen`: the command's target (the party, for an enemy's intent). `self`: the source's side.
   * `allEnemies`: every living enemy. Statuses on any party member land on the whole party.
   */
  target?: 'chosen' | 'self' | 'allEnemies';
}

export const applyStatus = (
  status: { id: string },
  stacks: Formula,
  target: ApplyStatusArgs['target'] = 'chosen',
): ApplyStatusArgs => ({ op: 'applyStatus', status: status.id, stacks, target });

function bearers(state: CombatState, args: ApplyStatusArgs, ctx: OpContext, registry: Registry): Bearer[] {
  const ids = args.target === 'allEnemies' ? state.enemies.filter(isAlive).map((e) => e.id) : [args.target === 'self' ? ctx.source : ctx.target];
  return ids.flatMap((id) => bearerOf(state, id, registry) ?? []);
}

export const applyStatusOp: Operation<ApplyStatusArgs> = {
  args: z.strictObject({
    op: z.literal('applyStatus'),
    status: z.string().min(1),
    stacks: formulaSchema,
    target: z.enum(['chosen', 'self', 'allEnemies']).optional(),
  }),
  validate: (state, args, ctx, registry) => (bearers(state, args, ctx, registry).length > 0 ? undefined : 'No one can bear this status.'),
  resolve(draft, args, ctx, registry) {
    const stacks = Math.max(0, Math.floor(evaluate(args.stacks, draft, ctx, registry)));
    return {
      events: bearers(draft, args, ctx, registry).flatMap((who) => {
        const status = landingStatus(who, args.status, registry);
        const def = registry.statuses[status];
        if (!def) return [];
        addStacks(who.statuses, def, stacks);
        return [{ type: 'statusApplied' as const, source: ctx.source, target: who.id, status, amount: stacks }];
      }),
    };
  },
  preview(state, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.stacks, state, ctx, registry)));
    return bearers(state, args, ctx, registry).map((who) => ({ op: 'applyStatus', target: who.id, status: landingStatus(who, args.status, registry), amount }));
  },
  describe(args, show) {
    const text = `Apply ${show(args.stacks)} ${titleCase(args.status.replace(/^status\./, ''))}`;
    return args.target === 'allEnemies' ? `${text} to all enemies` : text;
  },
};
