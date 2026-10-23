import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { bearerOf } from '../statuses.ts';

export interface ClearStatusesArgs extends OpCall {
  op: 'clearStatuses';
}

/** Removes every status from the source's side (a Boss's Rouse). */
export const clearStatuses = (): ClearStatusesArgs => ({ op: 'clearStatuses' });

export const clearStatusesOp: Operation<ClearStatusesArgs> = {
  args: z.strictObject({ op: z.literal('clearStatuses') }),
  resolve(draft, _args, ctx, registry) {
    const bearer = bearerOf(draft, ctx.source, registry);
    if (!bearer) return { events: [] };
    const removed = bearer.statuses.splice(0);
    return {
      events: removed.map((s): EngineEvent => ({ type: 'statusRemoved', source: ctx.source, target: bearer.id, status: s.status })),
    };
  },
  preview(state, _args, ctx, registry) {
    const bearer = bearerOf(state, ctx.source, registry);
    return [{ op: 'clearStatuses', ...(bearer ? { target: bearer.id, amount: bearer.statuses.length } : {}) }];
  },
  describe: () => 'Clear its statuses',
};
