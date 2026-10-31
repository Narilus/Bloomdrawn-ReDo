import { z } from 'zod';
import type { OpCall, Registry } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { newEnemy } from '../combat.ts';
import { isAlive, type CombatState } from '../state.ts';

export interface SummonArgs extends OpCall {
  op: 'summon';
  enemy: string;
  count: number;
  /** At most this many of that enemy alive at once. */
  max: number;
}

/** Brings new enemies into free slots. They join the turn order next round. */
export const summon = (enemy: { id: string }, count: number, max: number): SummonArgs => ({ op: 'summon', enemy: enemy.id, count, max });

/** How many would arrive now: limited by `count`, the living `max` and free slots. */
function room(state: CombatState, args: SummonArgs): number[] {
  const taken = new Set(state.enemies.filter(isAlive).map((e) => e.slot));
  const free = Array.from({ length: state.enemySlots }, (_, slot) => slot).filter((slot) => !taken.has(slot));
  const alive = state.enemies.filter((e) => isAlive(e) && e.enemy === args.enemy).length;
  return free.slice(0, Math.max(0, Math.min(args.count, args.max - alive)));
}

export const summonOp: Operation<SummonArgs> = {
  args: z.strictObject({ op: z.literal('summon'), enemy: z.string().min(1), count: z.int().positive(), max: z.int().positive() }),
  validate: (state, args) => (room(state, args).length > 0 ? undefined : 'No room to summon.'),
  resolve(draft, args, ctx, registry: Registry) {
    const events: EngineEvent[] = [];
    for (const slot of room(draft, args)) {
      const enemy = newEnemy(registry, args.enemy, `e${draft.nextUid++}`, slot, draft);
      draft.enemies.push(enemy);
      events.push({ type: 'enemySummoned', source: ctx.source, target: enemy.id });
    }
    return { events };
  },
  preview: (state, args) => [{ op: 'summon', amount: room(state, args).length }],
  describe: (args, _show, registry) => `Summon ${args.count} ${registry.enemies[args.enemy]?.name ?? args.enemy}`,
};
