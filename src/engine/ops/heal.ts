import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import { enemyLevelScale } from '../levels.ts';
import { floorAmount } from '../modifiers.ts';
import type { Operation, OpContext } from '../operation.ts';
import { allIntents } from '../phases.ts';
import { isAlive, PARTY, type CombatState, type Enemy, type EntityId } from '../state.ts';

type HealTarget = 'lowestAlly' | 'leaderFirst';
const TARGETS = ['lowestAlly', 'leaderFirst'] as const;

export interface HealArgs extends OpCall {
  op: 'heal';
  amount: Formula;
  /**
   * `lowestAlly`: an enemy heals the living enemy with the lowest HP (ties: earlier slot).
   * `leaderFirst` (Suture; owner, 1 Nov): a hurt ally that leads, a Boss (it has HP bars) or a
   * summoner; else the hurt ally missing the largest share of its HP; else itself. Among several,
   * the largest share missing, then the earlier slot.
   */
  target?: HealTarget;
}

/** Heals the source's side: the shared party pool, or the enemy itself. Never past max HP. */
export const heal = (amount: Formula, target?: HealTarget): HealArgs => ({ op: 'heal', amount, ...(target ? { target } : {}) });

const missing = (e: Enemy) => (e.maxHp - e.hp) / e.maxHp;
const mostHurt = (enemies: Enemy[]) =>
  [...enemies].sort((a, b) => a.slot - b.slot).reduce<Enemy | undefined>((best, e) => (!best || missing(e) > missing(best) ? e : best), undefined);

function leads(enemy: Enemy, registry: Registry): boolean {
  const def = registry.enemies[enemy.enemy];
  return !!def?.phases?.length || allIntents(def).some((i) => i.effects.some((c) => c.op === 'summon'));
}

function poolOf(state: CombatState, args: HealArgs, ctx: OpContext, registry: Registry): { id: EntityId; pool: { hp: number; maxHp: number } } | undefined {
  if (state.members.some((m) => m.id === ctx.source)) return { id: PARTY, pool: state.party };
  const enemy = state.enemies.find((e) => e.id === ctx.source);
  if (!enemy || !isAlive(enemy)) return undefined;
  if (args.target === 'lowestAlly') {
    const lowest = state.enemies.filter(isAlive).reduce((best, e) => (e.hp < best.hp ? e : best), enemy);
    return { id: lowest.id, pool: lowest };
  }
  if (args.target === 'leaderFirst') {
    const hurt = state.enemies.filter((e) => isAlive(e) && e.id !== enemy.id && e.hp < e.maxHp);
    const chosen = mostHurt(hurt.filter((e) => leads(e, registry))) ?? mostHurt(hurt) ?? enemy;
    return { id: chosen.id, pool: chosen };
  }
  return { id: enemy.id, pool: enemy };
}

const healed = (state: CombatState, args: HealArgs, ctx: OpContext, registry: Registry) => {
  const target = poolOf(state, args, ctx, registry);
  if (!target) return undefined;
  // An enemy heals in step with its HP at the fight's enemy level; rounded once, at the end.
  const scale = target.id === PARTY ? 1 : enemyLevelScale(state.enemyLevel).hp / 1000;
  const amount = floorAmount(evaluate(args.amount, state, ctx, registry) * scale);
  return { target, amount: Math.min(amount, target.pool.maxHp - target.pool.hp) };
};

export const healOp: Operation<HealArgs> = {
  args: z.strictObject({ op: z.literal('heal'), amount: formulaSchema, target: z.enum(TARGETS).optional() }),
  validate: (state, args, ctx, registry) => (poolOf(state, args, ctx, registry) ? undefined : 'Nothing to heal.'),
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
  describe: (args, show) =>
    args.target === 'lowestAlly'
      ? `Heal the weakest enemy ${show(args.amount)}`
      : args.target === 'leaderFirst'
        ? `Heal ${show(args.amount)}: a hurt Boss or summoner first, else the most hurt ally, else itself`
        : `Heal ${show(args.amount)}`,
};
