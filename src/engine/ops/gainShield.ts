import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { formulaSchema, type Formula } from '../formula.ts';
import { pipeline } from '../modifiers.ts';
import type { Operation, OpContext, Preview } from '../operation.ts';
import { isAlive, PARTY, type CombatState, type EntityId } from '../state.ts';

export interface GainShieldArgs extends OpCall {
  op: 'gainShield';
  amount: Formula;
  /** `allies`: an enemy shields every living enemy, itself included. */
  target?: 'allies';
}

export const gainShield = (amount: Formula, target?: 'allies'): GainShieldArgs => ({ op: 'gainShield', amount, ...(target ? { target } : {}) });

/** Shield goes to the source's side: the shared party pool, or the enemy itself (or every enemy, for `allies`). */
function holdersOf(state: CombatState, args: GainShieldArgs, ctx: OpContext): EntityId[] {
  if (state.members.some((m) => m.id === ctx.source)) return [PARTY];
  if (!state.enemies.some((e) => e.id === ctx.source)) return [];
  return args.target === 'allies' ? state.enemies.filter(isAlive).map((e) => e.id) : [ctx.source];
}

function compute(state: CombatState, args: GainShieldArgs, ctx: OpContext, registry: Registry): Preview[] {
  const amount = pipeline('shield', args.amount, state, ctx, registry);
  return holdersOf(state, args, ctx).map((target) => ({ op: 'gainShield', target, amount }));
}

export const gainShieldOp: Operation<GainShieldArgs> = {
  args: z.strictObject({ op: z.literal('gainShield'), amount: formulaSchema, target: z.literal('allies').optional() }),
  validate: (state, args, ctx) => (holdersOf(state, args, ctx).length > 0 ? undefined : 'Nothing can hold this Shield.'),
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
  describe: (args, show) => `${args.target === 'allies' ? 'Every enemy gains' : 'Gain'} ${show(args.amount, 'shield')} Shield`,
};
