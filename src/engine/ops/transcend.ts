import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { Operation } from '../operation.ts';

export interface TranscendArgs extends OpCall {
  op: 'transcend';
}

/** The owner Transcends: her Transcended ultimate replaces her ultimate for the rest of the combat. Once per combat. */
export const transcend = (): TranscendArgs => ({ op: 'transcend' });

export const transcendOp: Operation<TranscendArgs> = {
  args: z.strictObject({ op: z.literal('transcend') }),
  validate(state, _args, ctx) {
    const member = state.members.find((m) => m.id === ctx.owner);
    if (!member) return 'Only a party member can Transcend.';
    return member.transcended ? 'She has already Transcended this combat.' : undefined;
  },
  resolve(draft, _args, ctx) {
    const member = draft.members.find((m) => m.id === ctx.owner);
    if (!member || member.transcended) return { events: [] };
    member.transcended = true;
    return { events: [{ type: 'transcended', source: member.id, owner: member.id }] };
  },
  preview: (_state, _args, ctx) => [{ op: 'transcend', ...(ctx.owner ? { target: ctx.owner } : {}) }],
  describe: () => 'Transcend: her ultimate is upgraded for this combat',
};
