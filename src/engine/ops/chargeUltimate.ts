import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import type { Operation, OpContext } from '../operation.ts';
import { GAUGE_MAX, type CombatState, type Member } from '../state.ts';

export interface ChargeUltimateArgs extends OpCall {
  op: 'chargeUltimate';
  amount: Formula;
  /** `owner`: the card's or passive's owner. `party`: every party member. `eventOwner`: whoever owns the card in the triggering event (relics). */
  who?: 'owner' | 'party' | 'eventOwner';
}

export const chargeUltimate = (amount: Formula, who: ChargeUltimateArgs['who'] = 'owner'): ChargeUltimateArgs => ({
  op: 'chargeUltimate',
  amount,
  who,
});

const chargedOf = (state: CombatState, args: ChargeUltimateArgs, ctx: OpContext): Member[] => {
  if (args.who === 'party') return state.members;
  const id = args.who === 'eventOwner' ? ctx.event?.owner : ctx.owner;
  return state.members.filter((m) => m.id === id);
};

export const chargeUltimateOp: Operation<ChargeUltimateArgs> = {
  args: z.strictObject({ op: z.literal('chargeUltimate'), amount: formulaSchema, who: z.enum(['owner', 'party', 'eventOwner']).optional() }),
  validate: (state, args, ctx) => (chargedOf(state, args, ctx).length > 0 ? undefined : 'No ultimate to charge.'),
  resolve(draft, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.amount, draft, ctx, registry)));
    const events: EngineEvent[] = [];
    for (const member of chargedOf(draft, args, ctx)) {
      const gained = Math.min(amount, GAUGE_MAX - member.gauge);
      member.gauge += gained;
      events.push({ type: 'ultimateCharged', source: ctx.source, target: member.id, amount: gained });
    }
    return { events };
  },
  preview(state, args, ctx, registry) {
    const amount = Math.max(0, Math.floor(evaluate(args.amount, state, ctx, registry)));
    return chargedOf(state, args, ctx).map((m) => ({
      op: 'chargeUltimate',
      target: m.id,
      amount: Math.min(amount, GAUGE_MAX - m.gauge),
    }));
  },
  describe: (args, show) =>
    args.who === 'party'
      ? `Charge every party member's ultimate by ${show(args.amount)}`
      : args.who === 'eventOwner'
        ? `Charge that card's owner's ultimate by ${show(args.amount)}`
        : `Charge her ultimate by ${show(args.amount)}`,
};
