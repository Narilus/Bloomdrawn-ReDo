import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import { formulaSchema, type Formula } from '../formula.ts';
import { pipeline } from '../modifiers.ts';
import type { Operation, OpContext } from '../operation.ts';
import { PARTY, type CombatState, type EntityId } from '../state.ts';

export interface GainShieldArgs extends OpCall {
  op: 'gainShield';
  amount: Formula;
}

export const gainShield = (amount: Formula): GainShieldArgs => ({ op: 'gainShield', amount });

/** Shield goes to the source's side: the shared party pool, or the enemy itself. */
function holderOf(state: CombatState, ctx: OpContext): EntityId | undefined {
  if (state.members.some((m) => m.id === ctx.source)) return PARTY;
  return state.enemies.some((e) => e.id === ctx.source) ? ctx.source : undefined;
}

function compute(state: CombatState, args: GainShieldArgs, ctx: OpContext, registry: Registry) {
  const target = holderOf(state, ctx);
  return target === undefined ? undefined : { target, amount: pipeline('shield', args.amount, state, ctx, registry) };
}

export const gainShieldOp: Operation<GainShieldArgs> = {
  args: z.strictObject({ op: z.literal('gainShield'), amount: formulaSchema }),
  validate: (state, _args, ctx) => (holderOf(state, ctx) ? undefined : 'Nothing can hold this Shield.'),
  resolve(draft, args, ctx, registry) {
    const gain = compute(draft, args, ctx, registry);
    if (!gain) return { events: [] };
    const holder = gain.target === PARTY ? draft.party : draft.enemies.find((e) => e.id === gain.target);
    if (holder) holder.shield += gain.amount;
    const event = { type: 'shieldGained' as const, source: ctx.source, target: gain.target, amount: gain.amount };
    return { events: [ctx.owner === undefined ? event : { ...event, owner: ctx.owner }] };
  },
  preview(state, args, ctx, registry) {
    const gain = compute(state, args, ctx, registry);
    return gain ? [{ op: 'gainShield', ...gain }] : [];
  },
  describe: (args, show) => `Gain ${show(args.amount, 'shield')} Shield`,
};
