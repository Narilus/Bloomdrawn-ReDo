import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { fall, isImmune } from '../phases.ts';
import { isAlive } from '../state.ts';

export interface WitherArgs extends OpCall {
  op: 'wither';
}

/**
 * The source enemy loses all its HP, Shield or not (the Garden Husk after its Burst; bestiary.md,
 * "Burst, then withers"). It comes after the Burst in the same intent, so killing the enemy first
 * cancels both, and nothing happens on its death.
 */
export const wither = (): WitherArgs => ({ op: 'wither' });

export const witherOp: Operation<WitherArgs> = {
  args: z.strictObject({ op: z.literal('wither') }),
  resolve(draft, _args, ctx, registry) {
    const enemy = draft.enemies.find((e) => e.id === ctx.source);
    if (!enemy || !isAlive(enemy) || isImmune(draft, enemy.id)) return { events: [] };
    const amount = enemy.hp;
    enemy.hp = 0;
    const base: EngineEvent = { type: 'damageDealt', source: ctx.source, target: enemy.id, amount, absorbed: 0 };
    return { events: [base, { ...base, type: 'damageTaken' }, fall(draft, enemy, ctx.source, registry)] };
  },
  preview: (state, _args, ctx) => {
    const enemy = state.enemies.find((e) => e.id === ctx.source);
    return enemy && isAlive(enemy) ? [{ op: 'wither', target: enemy.id, amount: enemy.hp }] : [];
  },
  describe: () => 'Then it withers',
};
