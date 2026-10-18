import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';

export interface LoseHpArgs extends OpCall {
  op: 'loseHp';
  amount: Formula;
  /** `self`: the source (a status's bearer); a party member loses from the shared pool. */
  target?: 'self' | 'chosen';
  /** Shield absorbs it first (Poison). */
  blockedByShield?: boolean;
}

/** Damage over time: a fixed amount that no modifier changes. Shield absorbs it only if `blockedByShield`. */
export const loseHp = (amount: Formula, options: Omit<LoseHpArgs, 'op' | 'amount'> = {}): LoseHpArgs => ({
  op: 'loseHp',
  amount,
  target: 'self',
  ...options,
});

function victimOf(state: CombatState, args: LoseHpArgs, ctx: OpContext): { id: EntityId; pool: { hp: number; shield: number } } | undefined {
  const id = args.target === 'chosen' ? ctx.target : ctx.source;
  if (state.members.some((m) => m.id === id)) return { id: PARTY, pool: state.party };
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy && isAlive(enemy) ? { id: enemy.id, pool: enemy } : undefined;
}

export const loseHpOp: Operation<LoseHpArgs> = {
  args: z.strictObject({
    op: z.literal('loseHp'),
    amount: formulaSchema,
    target: z.enum(['self', 'chosen']).optional(),
    blockedByShield: z.boolean().optional(),
  }),
  validate: (state, args, ctx) => (victimOf(state, args, ctx) ? undefined : 'Nothing living to lose HP.'),
  resolve(draft, args, ctx, registry) {
    const victim = victimOf(draft, args, ctx);
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    if (!victim || amount === 0) return { events: [] };
    const absorbed = args.blockedByShield ? Math.min(victim.pool.shield, amount) : 0;
    victim.pool.shield -= absorbed;
    victim.pool.hp = Math.max(0, victim.pool.hp - (amount - absorbed));
    const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: victim.id, amount, absorbed };
    const events: EngineEvent[] = [base, { ...base, type: 'damageTaken' }];
    if (victim.id !== PARTY && victim.pool.hp <= 0) events.push({ type: 'enemyDefeated', source: ctx.source, target: victim.id });
    return { events };
  },
  preview(state, args, ctx, registry) {
    const victim = victimOf(state, args, ctx);
    if (!victim) return [];
    const amount = Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));
    const absorbed = args.blockedByShield ? Math.min(victim.pool.shield, amount) : 0;
    return [{ op: 'loseHp', target: victim.id, amount, absorbed }];
  },
  describe: (args, show) => (args.blockedByShield ? `Take ${show(args.amount)} damage` : `Lose ${show(args.amount)} HP`),
};
