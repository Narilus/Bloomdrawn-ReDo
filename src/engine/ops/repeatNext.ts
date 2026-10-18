import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { Operation } from '../operation.ts';

export interface RepeatNextArgs extends OpCall {
  op: 'repeatNext';
}

/** The next card played this turn resolves its effects once more. Its ultimate charge is not repeated. */
export const repeatNext = (): RepeatNextArgs => ({ op: 'repeatNext' });

export const repeatNextOp: Operation<RepeatNextArgs> = {
  args: z.strictObject({ op: z.literal('repeatNext') }),
  resolve(draft) {
    draft.next.repeat += 1;
    return { events: [] };
  },
  preview: () => [{ op: 'repeatNext', amount: 1 }],
  describe: () => 'The next card you play this turn resolves twice',
};
