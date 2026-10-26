import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { evaluate, formulaSchema, type Formula } from '../formula.ts';
import { pipeline, volleyPasses } from '../modifiers.ts';
import type { Operation, OpContext, Preview } from '../operation.ts';
import { fall } from '../phases.ts';
import { isAlive, vitalsOf, type CombatState, type Enemy, type Vitals } from '../state.ts';

export interface VolleyArgs extends OpCall {
  op: 'volley';
  hits: Formula;
  damage: Formula;
}

/**
 * `hits` hits of `damage` each. Every hit takes the lowest-HP enemy, and excess carries to the next.
 * With extra passes (Dance of Bells), the volley fires again, each pass choosing from the HP the last left.
 */
export const volley = (hits: Formula, damage: Formula): VolleyArgs => ({ op: 'volley', hits, damage });

/** Lowest HP first; ties go to the earlier slot. A rousing enemy can't be hurt, so hits pass it by. */
const lowest = (state: CombatState): Enemy | undefined =>
  state.enemies.filter((e) => isAlive(e) && !e.rousing).reduce<Enemy | undefined>((best, e) => (!best || e.hp < best.hp ? e : best), undefined);

/** Every hit lands in turn; the HP and Shield after each event go with it, so bars and the end check follow the hits. */
function fire(draft: CombatState, args: VolleyArgs, ctx: OpContext, registry: Registry): { events: EngineEvent[]; vitals: Vitals[] } {
  const events: EngineEvent[] = [];
  const vitals: Vitals[] = [];
  const push = (...landed: EngineEvent[]) => {
    events.push(...landed);
    vitals.push(...landed.map(() => vitalsOf(draft)));
  };
  const hits = Math.max(0, Math.floor(evaluate(args.hits, draft, ctx, registry)));
  // A volley with no hits, or nothing to hit, does nothing at all.
  if (hits === 0 || !lowest(draft)) return { events, vitals };
  const fired: EngineEvent = { type: 'volleyFired', source: ctx.source };
  if (ctx.owner !== undefined) fired.owner = ctx.owner;
  if (ctx.card !== undefined) fired.card = ctx.card;
  push(fired);
  const passes = volleyPasses(draft, ctx, registry);
  for (let i = 0; i < hits * passes; i++) {
    let target = lowest(draft);
    if (!target) break;
    let remaining = pipeline('damage', args.damage, draft, ctx, registry, target.id);
    // A hit always lands on its target, even for 0; only excess beyond a kill moves on.
    do {
      const absorbed = Math.min(target.shield, remaining);
      const hpLoss = Math.min(target.hp, remaining - absorbed);
      target.shield -= absorbed;
      target.hp -= hpLoss;
      remaining -= absorbed + hpLoss;
      const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: target.id, amount: absorbed + hpLoss, absorbed, via: 'volley' };
      // A bar breaks with the hit that empties it, so no event shows a Boss with bars left at 0 HP.
      const fell = isAlive(target) ? undefined : fall(draft, target, ctx.source, registry);
      push(base, { ...base, type: 'damageTaken' });
      if (fell) push(fell);
      // A broken bar takes the rest of the hit with it.
      if (fell?.type === 'barBroken') remaining = 0;
      target = remaining > 0 ? lowest(draft) : undefined;
    } while (target);
  }
  return { events, vitals };
}

export const volleyOp: Operation<VolleyArgs> = {
  args: z.strictObject({ op: z.literal('volley'), hits: formulaSchema, damage: formulaSchema }),
  resolve: (draft, args, ctx, registry) => fire(draft, args, ctx, registry),
  preview(state, args, ctx, registry) {
    return fire(structuredClone(state), args, ctx, registry)
      .events.filter((e) => e.type === 'damageDealt')
      .map((e): Preview => ({ op: 'volley', target: e.target as string, amount: e.amount as number, absorbed: e.absorbed as number }));
  },
  describe: (args, show) => `Volley: ${show(args.hits)} hits of ${show(args.damage, 'damage')} damage`,
};
