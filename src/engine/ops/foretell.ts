import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { Operation } from '../operation.ts';
import { intentsOf } from '../phases.ts';

export interface ForetellArgs extends OpCall {
  op: 'foretell';
}

/** Changes nothing; its preview names the source enemy's next intent, so a countdown is read a turn ahead (Ripen). */
export const foretell = (): ForetellArgs => ({ op: 'foretell' });

export const foretellOp: Operation<ForetellArgs> = {
  args: z.strictObject({ op: z.literal('foretell') }),
  resolve: () => ({ events: [] }),
  preview(state, _args, ctx, registry) {
    const enemy = state.enemies.find((e) => e.id === ctx.source);
    const intents = enemy ? intentsOf(enemy, registry) : [];
    if (!enemy || enemy.intent === undefined || intents.length === 0) return [];
    return [{ op: 'foretell', target: enemy.id, name: intents[(enemy.intent + 1) % intents.length]!.name }];
  },
  describe: () => 'Shows what it does next turn',
};
