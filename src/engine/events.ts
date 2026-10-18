import type { EntityId } from './state.ts';

export const EVENT_TYPES = [
  // Lifecycle
  'combatStart',
  'turnStart',
  'turnEnd',
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
  'statusApplied',
  'statusRemoved',
  'resourceGained',
  'resourceConsumed',
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
}
