import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { formulaSchema, type Formula } from '../formula.ts';
import { critChance, rollCrit } from '../crit.ts';
import { pipeline } from '../modifiers.ts';
import type { Operation, OpContext, Preview } from '../operation.ts';
import { fall } from '../phases.ts';
import { isAlive, PARTY, vitalsOf, type CombatState, type EntityId, type Vitals } from '../state.ts';
import type { Registry } from '../defs.ts';

export interface DamageArgs extends OpCall {
  op: 'damage';
  amount: Formula;
  /** `chosen`: the command's target. `party`: the shared party pool. `allEnemies`: every living enemy, in slot order. */
  target?: 'chosen' | 'party' | 'allEnemies';
  ignoresShield?: boolean;
}

export const damage = (amount: Formula, options: Omit<DamageArgs, 'op' | 'amount'> = {}): DamageArgs => ({
  op: 'damage',
  amount,
  ...options,
});

interface Hit {
  target: EntityId;
  amount: number;
  absorbed: number;
}

function targetsOf(state: CombatState, args: DamageArgs, ctx: OpContext): EntityId[] {
  if (args.target === 'allEnemies') return state.enemies.filter(isAlive).map((e) => e.id);
  const target = args.target === 'party' ? PARTY : ctx.target;
  return target !== undefined && pool(state, target) ? [target] : [];
}

function pool(state: CombatState, target: EntityId): { hp: number; shield: number } | undefined {
  if (target === PARTY) return state.party;
  const enemy = state.enemies.find((e) => e.id === target);
  return enemy && isAlive(enemy) ? enemy : undefined;
}

/** Shared by resolve and preview: pipeline steps 1–4, a crit's multiplier if it crit, then Shield (step 5). */
function compute(state: CombatState, args: DamageArgs, ctx: OpContext, registry: Registry, target: EntityId, crit = 1): Hit | undefined {
  const hit = pool(state, target);
  if (!hit) return undefined;
  const amount = pipeline('damage', args.amount, state, ctx, registry, target, undefined, crit);
  const absorbed = args.ignoresShield ? 0 : Math.min(hit.shield, amount);
  return { target, amount, absorbed };
}

/** Each target is hit in turn; the HP and Shield after each event go with it, so bars follow the hits. */
function land(draft: CombatState, args: DamageArgs, ctx: OpContext, registry: Registry): { events: EngineEvent[]; vitals: Vitals[] } {
  const events: EngineEvent[] = [];
  const vitals: Vitals[] = [];
  for (const target of targetsOf(draft, args, ctx)) {
    if (!pool(draft, target)) continue;
    const roll = rollCrit(draft, ctx, registry);
    const hit = compute(draft, args, ctx, registry, target, roll.mul);
    if (!hit) continue;
    const victim = pool(draft, hit.target) as { hp: number; shield: number };
    victim.shield -= hit.absorbed;
    victim.hp = Math.max(0, victim.hp - (hit.amount - hit.absorbed));

    const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: hit.target, amount: hit.amount, absorbed: hit.absorbed };
    if (ctx.owner !== undefined) base.owner = ctx.owner;
    if (roll.crit) base.crit = true;
    const landed: EngineEvent[] = [base, { ...base, type: 'damageTaken' }];
    const enemy = draft.enemies.find((e) => e.id === hit.target);
    if (enemy && enemy.hp <= 0) landed.push(fall(draft, enemy, ctx.source, registry));
    events.push(...landed);
    vitals.push(...landed.map(() => vitalsOf(draft)));
  }
  return { events, vitals };
}

export const damageOp: Operation<DamageArgs> = {
  args: z.strictObject({
    op: z.literal('damage'),
    amount: formulaSchema,
    target: z.enum(['chosen', 'party', 'allEnemies']).optional(),
    ignoresShield: z.boolean().optional(),
  }),
  validate(state, args, ctx) {
    return targetsOf(state, args, ctx).length > 0 ? undefined : 'Damage needs a living target.';
  },
  resolve: (draft, args, ctx, registry) => land(draft, args, ctx, registry),
  preview(state, args, ctx, registry) {
    return targetsOf(state, args, ctx).flatMap((target) => {
      const hit = compute(state, args, ctx, registry, target);
      if (!hit) return [];
      const chance = critChance(state, ctx, registry);
      const crit = chance && chance.rate > 0 ? { amount: compute(state, args, ctx, registry, target, 1 + chance.damage / 100)!.amount, rate: chance.rate } : undefined;
      return [{ op: 'damage', ...hit, ...(crit && { crit }) } satisfies Preview];
    });
  },
  describe(args, show) {
    const amount = show(args.amount, 'damage');
    const who = args.target === 'party' ? ' to the party' : args.target === 'allEnemies' ? ' to all enemies' : '';
    return `Deal ${amount} damage${who}${args.ignoresShield ? ', ignoring Shield' : ''}`;
  },
};
