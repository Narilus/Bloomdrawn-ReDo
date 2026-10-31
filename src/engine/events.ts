import type { CardSlot } from './defs.ts';
import type { EntityId } from './state.ts';

export const EVENT_TYPES = [
  // Lifecycle
  'combatStart',
  'turnStart',
  // The turn's hand has been drawn: "at turn start, draw" effects hang here so the draw-to-5 can't swallow them.
  'handDrawn',
  // Mana debt came off this turn's refill; raised after the turn's draw.
  'manaDebtPaid',
  // Unplayed cards left the hand; Retained cards were held.
  'cleanup',
  'turnEnd',
  // Damage over time, after the end-of-turn effects and Tentacles: the enemies' at the end of the party's turn, the party's after the enemy phase.
  'statusTick',
  'enemyPhaseStart',
  'enemyActed',
  'combatEnd',
  // Actions
  'cardPlayed',
  'ultimateFired',
  'transcended',
  // A volley began, before its hits (a card's, an ultimate's or the end-of-turn attack).
  'volleyFired',
  // An enemy's action was skipped (Stun, Delay) or weakened (Falter) by a control status.
  'controlled',
  // Outcomes
  'damageDealt',
  'damageTaken',
  'shieldGained',
  'healed',
  'statusApplied',
  'statusRemoved',
  'resourceGained',
  'resourceConsumed',
  'ultimateCharged',
  'cardDrawn',
  'cardCreated',
  'cardExhausted',
  'enemyDefeated',
  /** An enemy's HP bar emptied and its next bar came up (a Boss's phase change). */
  'barBroken',
  'enemySummoned',
  'deckShuffled',
  // Bookkeeping: a trigger chain hit MAX_CHAIN_DEPTH and its remaining operations were dropped.
  'chainCapped',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EngineEvent {
  type: EventType;
  source?: EntityId;
  owner?: EntityId;
  target?: EntityId;
  amount?: number;
  /** Damage absorbed by Shield; HP lost is amount − absorbed. */
  absorbed?: number;
  /** A party hit that crit. */
  crit?: boolean;
  /** Card instance UID: the card played, or the card resolving when the event was raised. */
  card?: EntityId;
  /** For `cardPlayed`: the card's definition ID. */
  def?: string;
  resource?: string;
  status?: string;
  outcome?: 'victory' | 'defeat';
  /** For `cardPlayed`: the card's personal slot, if it has one. */
  slot?: CardSlot;
  /** How it came about, where presentation needs to know: `volley` hits, a control status's `skip`. */
  via?: string;
}
