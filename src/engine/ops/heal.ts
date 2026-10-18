import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';

export interface HealArgs extends OpCall {
  op: 'heal';
  amount: Formula;
}

/** Heals the source's side: the shared party pool, or the enemy itself. Never past max HP. */
export const heal = (amount: Formula): HealArgs => ({ op: 'heal', amount });

function poolOf(state: CombatState, ctx: OpContext): { id: EntityId; pool: { hp: number; maxHp: number } } | undefined {
  if (state.members.some((m) => m.id === ctx.source)) return { id: PARTY, pool: state.party };
  const enemy = state.enemies.find((e) => e.id === ctx.source);
  return enemy && isAlive(enemy) ? { id: enemy.id, pool: enemy } : undefined;
}

const healed = (state: CombatState, args: HealArgs, ctx: OpContext, registry: Parameters<typeof evaluate>[3]) => {
  const target = poolOf(state, ctx);
  if (!target) return undefined;
  const amount = Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));
  return { target, amount: Math.min(amount, target.pool.maxHp - target.pool.hp) };
};

export const healOp: Operation<HealArgs> = {
  args: z.strictObject({ op: z.literal('heal'), amount: formulaSchema }),
  validate: (state, _args, ctx) => (poolOf(state, ctx) ? undefined : 'Nothing to heal.'),
  resolve(draft, args, ctx, registry) {
    const result = healed(draft, args, ctx, registry);
    if (!result) return { events: [] };
    result.target.pool.hp += result.amount;
    const event = { type: 'healed' as const, source: ctx.source, target: result.target.id, amount: result.amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview(state, args, ctx, registry) {
    const result = healed(state, args, ctx, registry);
    return result ? [{ op: 'heal', target: result.target.id, amount: result.amount }] : [];
  },
  describe: (args, show) => `Heal ${show(args.amount)}`,
};
