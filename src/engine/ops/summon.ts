import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import { titleCase } from '../formula.ts';
import type { Operation } from '../operation.ts';
import { newEnemy } from '../combat.ts';
import { isAlive, type CombatState } from '../state.ts';
import { addStacks, landingStatus } from '../statuses.ts';

export interface SummonArgs extends OpCall {
  op: 'summon';
  enemy: string;
  count: number;
  /** At most this many of that enemy alive at once. */
  max: number;
  /** Each arrival after the first comes with one stack of this status (Delay: it acts a step behind). */
  stagger?: string;
}

/** Brings new enemies into free slots. They join the turn order next round. */
export const summon = (enemy: { id: string }, count: number, max: number, stagger?: { id: string }): SummonArgs => ({
  op: 'summon', enemy: enemy.id, count, max, ...(stagger ? { stagger: stagger.id } : {}),
});

/** How many would arrive now: limited by `count`, the living `max` and free slots. */
function room(state: CombatState, args: SummonArgs): number[] {
  const taken = new Set(state.enemies.filter(isAlive).map((e) => e.slot));
  const free = Array.from({ length: state.enemySlots }, (_, slot) => slot).filter((slot) => !taken.has(slot));
  const alive = state.enemies.filter((e) => isAlive(e) && e.enemy === args.enemy).length;
  return free.slice(0, Math.max(0, Math.min(args.count, args.max - alive)));
}

export const summonOp: Operation<SummonArgs> = {
  args: z.strictObject({
    op: z.literal('summon'), enemy: z.string().min(1), count: z.int().positive(), max: z.int().positive(), stagger: z.string().min(1).optional(),
  }),
  validate: (state, args) => (room(state, args).length > 0 ? undefined : 'No room to summon.'),
  resolve(draft, args, ctx, registry: Registry) {
    const events: EngineEvent[] = [];
    for (const [i, slot] of room(draft, args).entries()) {
      const enemy = newEnemy(registry, args.enemy, `e${draft.nextUid++}`, slot, draft);
      draft.enemies.push(enemy);
      events.push({ type: 'enemySummoned', source: ctx.source, target: enemy.id });
      const resists = !!registry.enemies[enemy.enemy]?.traits?.includes('resistsControl');
      const status = i > 0 && args.stagger ? landingStatus({ id: enemy.id, statuses: enemy.statuses, resistsControl: resists }, args.stagger, registry) : undefined;
      const def = status === undefined ? undefined : registry.statuses[status];
      if (def) {
        addStacks(enemy.statuses, def, 1);
        events.push({ type: 'statusApplied', source: ctx.source, target: enemy.id, status: def.id, amount: 1 });
      }
    }
    return { events };
  },
  preview: (state, args) => [{ op: 'summon', amount: room(state, args).length }],
  describe(args, _show, registry) {
    const text = `Summon ${args.count} ${registry.enemies[args.enemy]?.name ?? args.enemy}`;
    return args.stagger ? `${text}, each after the first with ${titleCase(args.stagger.replace(/^status\./, ''))}` : text;
  },
};
