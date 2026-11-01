import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { formulaSchema, type Formula } from '../formula.ts';
import { leaderFirst } from '../allies.ts';
import { pipeline } from '../modifiers.ts';
import type { Operation, OpContext, Preview } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type Enemy, type EntityId } from '../state.ts';

export interface GainShieldArgs extends OpCall {
  op: 'gainShield';
  amount: Formula;
  /**
   * For an enemy, itself included: `allies`, every living enemy; `lowestAlly`, the living enemy with
   * the lowest HP; `largestAlly`, the one with the most max HP (ties: the earlier one);
   * `leaderFirst`, where a heal with that target goes, so Shield and heal land together (Graft).
   */
  target?: ShieldTarget;
}

type ShieldTarget = 'allies' | 'lowestAlly' | 'largestAlly' | 'leaderFirst';
const TARGETS = ['allies', 'lowestAlly', 'largestAlly', 'leaderFirst'] as const;

export const gainShield = (amount: Formula, target?: ShieldTarget): GainShieldArgs => ({ op: 'gainShield', amount, ...(target ? { target } : {}) });

/** Shield goes to the source's side: the shared party pool, or the enemy itself (or the allies its target names). */
function holdersOf(state: CombatState, args: GainShieldArgs, ctx: OpContext, registry: Registry): EntityId[] {
  if (state.members.some((m) => m.id === ctx.source)) return [PARTY];
  const self = state.enemies.find((e) => e.id === ctx.source);
  if (!self) return [];
  if (args.target === 'leaderFirst') return [leaderFirst(state, self, registry).id];
  const alive = state.enemies.filter(isAlive);
  if (args.target === 'allies') return alive.map((e) => e.id);
  const pick = (better: (a: Enemy, b: Enemy) => boolean) => alive.reduce<Enemy | undefined>((best, e) => (!best || better(e, best) ? e : best), undefined);
  const chosen = args.target === 'lowestAlly' ? pick((a, b) => a.hp < b.hp) : args.target === 'largestAlly' ? pick((a, b) => a.maxHp > b.maxHp) : undefined;
  return [chosen?.id ?? ctx.source];
}

function compute(state: CombatState, args: GainShieldArgs, ctx: OpContext, registry: Registry): Preview[] {
  const amount = pipeline('shield', args.amount, state, ctx, registry);
  return holdersOf(state, args, ctx, registry).map((target) => ({ op: 'gainShield', target, amount }));
}

const GAINS: Record<ShieldTarget | 'self', string> = {
  self: 'Gain',
  allies: 'Every enemy gains',
  lowestAlly: 'The enemy with the lowest HP gains',
  largestAlly: 'The enemy with the most max HP gains',
  leaderFirst: 'A hurt Boss or summoner, else the most hurt ally, else itself, gains',
};

export const gainShieldOp: Operation<GainShieldArgs> = {
  args: z.strictObject({ op: z.literal('gainShield'), amount: formulaSchema, target: z.enum(TARGETS).optional() }),
  validate: (state, args, ctx, registry) => (holdersOf(state, args, ctx, registry).length > 0 ? undefined : 'Nothing can hold this Shield.'),
  resolve(draft, args, ctx, registry) {
    const events: EngineEvent[] = compute(draft, args, ctx, registry).map(({ target, amount }) => {
      const holder = target === PARTY ? draft.party : draft.enemies.find((e) => e.id === target);
      if (holder) holder.shield += amount ?? 0;
      const event: EngineEvent = { type: 'shieldGained', source: ctx.source, target: target as EntityId, amount: amount ?? 0 };
      if (ctx.owner !== undefined) event.owner = ctx.owner;
      return event;
    });
    return { events };
  },
  preview: (state, args, ctx, registry) => compute(state, args, ctx, registry),
  describe: (args, show) => `${GAINS[args.target ?? 'self']} ${show(args.amount, 'shield')} Shield`,
};
