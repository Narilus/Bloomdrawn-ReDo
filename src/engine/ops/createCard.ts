import { z } from 'zod';
import type { Keyword, OpCall } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { HAND_MAX, type CardInstance } from '../state.ts';

export interface CreateCardArgs extends OpCall {
  op: 'createCard';
  /** A generated card's ID; the new copy belongs to the creating card's owner. */
  card: string;
  /** The copy's own cost, in place of the printed one. */
  cost?: number;
  /** Keywords the copy has on top of its card's (Fleeting). */
  keywords?: Keyword[];
}

/** Makes a new copy of a card in hand (or the discard pile if the hand is full). It lasts the combat. */
export const createCard = (card: { id: string }, copy: Pick<CreateCardArgs, 'cost' | 'keywords'> = {}): CreateCardArgs => ({ op: 'createCard', card: card.id, ...copy });

export const createCardOp: Operation<CreateCardArgs> = {
  args: z.strictObject({
    op: z.literal('createCard'),
    card: z.string().min(1),
    cost: z.number().int().min(0).optional(),
    keywords: z.array(z.enum(['retain', 'ritual', 'exhaust', 'fleeting'])).optional(),
  }),
  validate: (state, _args, ctx) => (state.members.some((m) => m.id === ctx.owner) ? undefined : 'Only a party member can create cards.'),
  resolve(draft, args, ctx) {
    if (ctx.owner === undefined) return { events: [] };
    const instance: CardInstance = { uid: `c${draft.nextUid++}`, card: args.card, owner: ctx.owner };
    if (args.cost !== undefined) instance.cost = args.cost;
    if (args.keywords?.length) instance.keywords = [...args.keywords];
    const pile = draft.piles.hand.length < HAND_MAX ? draft.piles.hand : draft.piles.discard;
    pile.push(instance);
    const event: EngineEvent = { type: 'cardCreated', source: ctx.source, owner: ctx.owner, card: instance.uid };
    return { events: [event] };
  },
  preview: () => [{ op: 'createCard', amount: 1 }],
  describe: (args, _show, registry) => {
    const traits = [...(args.cost !== undefined ? [`costing ${args.cost}`] : []), ...(args.keywords ?? []).map((k) => k.charAt(0).toUpperCase() + k.slice(1))];
    return `Create a ${registry.cards[args.card]?.name ?? args.card}${traits.length ? ` (${traits.join(', ')})` : ''} in your hand`;
  },
};
