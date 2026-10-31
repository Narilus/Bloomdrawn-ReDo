import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import { byLevel, enemyLevelScale } from '../levels.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';

export interface HealArgs extends OpCall {
  op: 'heal';
  amount: Formula;
  /** `lowestAlly`: an enemy heals the living enemy with the lowest HP (ties: earlier slot). */
  target?: 'lowestAlly';
}

/** Heals the source's side: the shared party pool, or the enemy itself. Never past max HP. */
export const heal = (amount: Formula, target?: 'lowestAlly'): HealArgs => ({ op: 'heal', amount, ...(target ? { target } : {}) });

function poolOf(state: CombatState, args: HealArgs, ctx: OpContext): { id: EntityId; pool: { hp: number; maxHp: number } } | undefined {
  if (state.members.some((m) => m.id === ctx.source)) return { id: PARTY, pool: state.party };
  const enemy = state.enemies.find((e) => e.id === ctx.source);
  if (!enemy || !isAlive(enemy)) return undefined;
  if (args.target !== 'lowestAlly') return { id: enemy.id, pool: enemy };
  const lowest = state.enemies.filter(isAlive).reduce((best, e) => (e.hp < best.hp ? e : best), enemy);
  return { id: lowest.id, pool: lowest };
}

const healed = (state: CombatState, args: HealArgs, ctx: OpContext, registry: Parameters<typeof evaluate>[3]) => {
  const target = poolOf(state, args, ctx);
  if (!target) return undefined;
  const written = Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));
  // An enemy heals in step with its HP at the fight's enemy level.
  const amount = target.id === PARTY ? written : byLevel(written, enemyLevelScale(state.enemyLevel).hp);
  return { target, amount: Math.min(amount, target.pool.maxHp - target.pool.hp) };
};

export const healOp: Operation<HealArgs> = {
  args: z.strictObject({ op: z.literal('heal'), amount: formulaSchema, target: z.literal('lowestAlly').optional() }),
  validate: (state, args, ctx) => (poolOf(state, args, ctx) ? undefined : 'Nothing to heal.'),
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
  describe: (args, show) => (args.target === 'lowestAlly' ? `Heal the weakest enemy ${show(args.amount)}` : `Heal ${show(args.amount)}`),
};
