import { z } from 'zod';
import type { OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { HAND_MAX } from '../state.ts';

export interface CreateCardArgs extends OpCall {
  op: 'createCard';
  /** A generated card's ID; the new copy belongs to the creating card's owner. */
  card: string;
}

/** Makes a new copy of a card in hand (or the discard pile if the hand is full). It lasts the combat. */
export const createCard = (card: { id: string }): CreateCardArgs => ({ op: 'createCard', card: card.id });

export const createCardOp: Operation<CreateCardArgs> = {
  args: z.strictObject({ op: z.literal('createCard'), card: z.string().min(1) }),
  validate: (state, _args, ctx) => (state.members.some((m) => m.id === ctx.owner) ? undefined : 'Only a party member can create cards.'),
  resolve(draft, args, ctx) {
    if (ctx.owner === undefined) return { events: [] };
    const instance = { uid: `c${draft.nextUid++}`, card: args.card, owner: ctx.owner };
    const pile = draft.piles.hand.length < HAND_MAX ? draft.piles.hand : draft.piles.discard;
    pile.push(instance);
    const event: EngineEvent = { type: 'cardCreated', source: ctx.source, owner: ctx.owner, card: instance.uid };
    return { events: [event] };
  },
  preview: () => [{ op: 'createCard', amount: 1 }],
  describe: (args, _show, registry) => `Create a ${registry.cards[args.card]?.name ?? args.card} in your hand`,
};
