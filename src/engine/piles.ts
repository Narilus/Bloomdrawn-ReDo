import type { EngineEvent } from './events.ts';
import { shuffleInPlace } from './rng.ts';
import { HAND_MAX, type CombatState, type EntityId } from './state.ts';

/**
 * Draws up to `count` cards into the hand. The discard pile reshuffles only when a draw
 * needs it; draws beyond the hand maximum stay in the deck.
 */
export function drawCards(draft: CombatState, count: number, source?: EntityId): EngineEvent[] {
  const { piles } = draft;
  const events: EngineEvent[] = [];
  for (let i = 0; i < count && piles.hand.length < HAND_MAX; i++) {
    if (piles.draw.length === 0) {
      if (piles.discard.length === 0) break;
      piles.draw = piles.discard;
      piles.discard = [];
      shuffleInPlace(piles.draw, draft.rng, 'shuffle');
      events.push({ type: 'deckShuffled' });
    }
    const card = piles.draw.shift();
    if (!card) break;
    piles.hand.push(card);
    const event: EngineEvent = { type: 'cardDrawn', card: card.uid, owner: card.owner };
    if (source !== undefined) event.source = source;
    events.push(event);
  }
  return events;
}
