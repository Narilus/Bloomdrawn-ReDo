import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { formulaSchema, type Formula } from '../formula.ts';
import { pipeline } from '../modifiers.ts';
import type { Operation, OpContext, Preview } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';
import type { Registry } from '../defs.ts';

export interface DamageArgs extends OpCall {
  op: 'damage';
  amount: Formula;
  /** `chosen`: the command's target. `party`: the shared party pool. */
  target?: 'chosen' | 'party';
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

function targetOf(args: DamageArgs, ctx: OpContext): EntityId | undefined {
  return args.target === 'party' ? PARTY : ctx.target;
}

function pool(state: CombatState, target: EntityId): { hp: number; shield: number } | undefined {
  if (target === PARTY) return state.party;
  const enemy = state.enemies.find((e) => e.id === target);
  return enemy && isAlive(enemy) ? enemy : undefined;
}

/** Shared by resolve and preview: pipeline steps 1–4, then Shield (step 5). */
function compute(state: CombatState, args: DamageArgs, ctx: OpContext, registry: Registry): Hit | undefined {
  const target = targetOf(args, ctx);
  const hit = target === undefined ? undefined : pool(state, target);
  if (target === undefined || !hit) return undefined;
  const amount = pipeline('damage', args.amount, state, ctx, registry, target);
  const absorbed = args.ignoresShield ? 0 : Math.min(hit.shield, amount);
  return { target, amount, absorbed };
}

export const damageOp: Operation<DamageArgs> = {
  args: z.strictObject({
    op: z.literal('damage'),
    amount: formulaSchema,
    target: z.enum(['chosen', 'party']).optional(),
    ignoresShield: z.boolean().optional(),
  }),
  validate(state, args, ctx) {
    const target = targetOf(args, ctx);
    return target !== undefined && pool(state, target) ? undefined : 'Damage needs a living target.';
  },
  resolve(draft, args, ctx, registry) {
    const hit = compute(draft, args, ctx, registry);
    if (!hit) return { events: [] };
    const victim = pool(draft, hit.target) as { hp: number; shield: number };
    victim.shield -= hit.absorbed;
    victim.hp = Math.max(0, victim.hp - (hit.amount - hit.absorbed));

    const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: hit.target, amount: hit.amount, absorbed: hit.absorbed };
    if (ctx.owner !== undefined) base.owner = ctx.owner;
    const events: EngineEvent[] = [base, { ...base, type: 'damageTaken' }];
    if (hit.target !== PARTY && victim.hp <= 0) {
      events.push({ type: 'enemyDefeated', source: ctx.source, target: hit.target });
    }
    return { events };
  },
  preview(state, args, ctx, registry) {
    const hit = compute(state, args, ctx, registry);
    return hit ? [{ op: 'damage', ...hit } satisfies Preview] : [];
  },
  describe(args, show) {
    const amount = show(args.amount, 'damage');
    const who = args.target === 'party' ? ' to the party' : '';
    return `Deal ${amount} damage${who}${args.ignoresShield ? ', ignoring Shield' : ''}`;
  },
};
