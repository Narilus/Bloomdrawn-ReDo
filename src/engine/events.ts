import type { EntityId } from './state.ts';

export type EventType =
  // Lifecycle
  | 'combatStart'
  | 'turnStart'
  | 'turnEnd'
  | 'enemyPhaseStart'
  | 'enemyActed'
  | 'combatEnd'
  // Actions
  | 'cardPlayed'
  | 'ultimateFired'
  | 'transcended'
  // Outcomes
  | 'damageDealt'
  | 'damageTaken'
  | 'shieldGained'
  | 'statusApplied'
  | 'statusRemoved'
  | 'resourceGained'
  | 'resourceConsumed'
  | 'cardDrawn'
  | 'cardExhausted'
  | 'enemyDefeated'
  | 'deckShuffled'
  // Bookkeeping: a trigger chain hit MAX_CHAIN_DEPTH and its remaining operations were dropped.
  | 'chainCapped';

export interface EngineEvent {
  type: EventType;
  source?: EntityId;
  owner?: EntityId;
  target?: EntityId;
  amount?: number;
  /** Card instance UID. */
  card?: EntityId;
  resource?: string;
  status?: string;
  outcome?: 'victory' | 'defeat';
}
