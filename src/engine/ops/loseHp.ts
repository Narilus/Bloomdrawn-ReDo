import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { fall, isImmune } from '../phases.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';

export interface LoseHpArgs extends OpCall {
  op: 'loseHp';
  amount: Formula;
  /** `self`: the source (a status's bearer); a party member loses from the shared pool. `party`: the party (relics). */
  target?: 'self' | 'chosen' | 'party';
  /** Shield absorbs it first (Poison). */
  blockedByShield?: boolean;
  /** The status doing it, carried on the events for presentation. */
  status?: string;
}

/** Damage over time: a fixed amount that no modifier changes. Shield absorbs it only if `blockedByShield`. A rousing enemy loses nothing. */
export const loseHp = (amount: Formula, options: Omit<LoseHpArgs, 'op' | 'amount'> = {}): LoseHpArgs => ({
  op: 'loseHp',
  amount,
  target: 'self',
  ...options,
});

function victimOf(state: CombatState, args: LoseHpArgs, ctx: OpContext): { id: EntityId; pool: { hp: number; shield: number } } | undefined {
  const id = args.target === 'party' ? PARTY : args.target === 'chosen' ? ctx.target : ctx.source;
  if (id === PARTY || state.members.some((m) => m.id === id)) return { id: PARTY, pool: state.party };
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy && isAlive(enemy) ? { id: enemy.id, pool: enemy } : undefined;
}

const amountOf = (state: CombatState, args: LoseHpArgs, ctx: OpContext, registry: Registry, victim: EntityId | undefined) =>
  isImmune(state, victim) ? 0 : Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));

export const loseHpOp: Operation<LoseHpArgs> = {
  args: z.strictObject({
    op: z.literal('loseHp'),
    amount: formulaSchema,
    target: z.enum(['self', 'chosen', 'party']).optional(),
    blockedByShield: z.boolean().optional(),
    status: z.string().min(1).optional(),
  }),
  validate: (state, args, ctx) => (victimOf(state, args, ctx) ? undefined : 'Nothing living to lose HP.'),
  resolve(draft, args, ctx, registry) {
    const victim = victimOf(draft, args, ctx);
    const amount = amountOf(draft, args, ctx, registry, victim?.id);
    if (!victim || amount === 0) return { events: [] };
    const absorbed = args.blockedByShield ? Math.min(victim.pool.shield, amount) : 0;
    victim.pool.shield -= absorbed;
    victim.pool.hp = Math.max(0, victim.pool.hp - (amount - absorbed));
    const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: victim.id, amount, absorbed };
    if (args.status !== undefined) base.status = args.status;
    const events: EngineEvent[] = [base, { ...base, type: 'damageTaken' }];
    const enemy = draft.enemies.find((e) => e.id === victim.id);
    if (enemy && enemy.hp <= 0) events.push(fall(draft, enemy, ctx.source, registry));
    return { events };
  },
  preview(state, args, ctx, registry) {
    const victim = victimOf(state, args, ctx);
    if (!victim) return [];
    const amount = amountOf(state, args, ctx, registry, victim.id);
    const absorbed = args.blockedByShield ? Math.min(victim.pool.shield, amount) : 0;
    return [{ op: 'loseHp', target: victim.id, amount, absorbed }];
  },
  describe: (args, show) => (args.blockedByShield ? `Take ${show(args.amount)} damage` : `Lose ${show(args.amount)} HP`),
};
