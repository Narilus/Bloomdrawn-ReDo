import type { EntityId } from './state.ts';

export const EVENT_TYPES = [
  // Lifecycle
  'combatStart',
  'turnStart',
  // Mana debt came off this turn's refill; raised after the turn's draw.
  'manaDebtPaid',
  // Unplayed cards left the hand; Retained cards were held.
  'cleanup',
  'turnEnd',
  // Damage over time, after the end-of-turn effects and Tentacles.
  'statusTick',
  'enemyPhaseStart',
  'enemyActed',
  'combatEnd',
  // Actions
  'cardPlayed',
  'ultimateFired',
  'transcended',
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
  'cardExhausted',
  'enemyDefeated',
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
  /** Card instance UID. */
  card?: EntityId;
  resource?: string;
  status?: string;
  outcome?: 'victory' | 'defeat';
  /** How it came about, where presentation needs to know: `volley` hits, a control status's `skip`. */
  via?: string;
}
