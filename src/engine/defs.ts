import type { EventType } from './events.ts';
import type { Operation } from './operation.ts';

// Content definition shapes the engine reads. Content builds and validates these;
// the engine receives them through the registry argument and never imports content.

/** One operation call as JSON data, e.g. `{ op: 'damage', amount: ... }`. */
export interface OpCall {
  op: string;
  [arg: string]: unknown;
}

export interface TriggerFilter {
  /** Relation of the event's source to the trigger's holder. */
  source?: 'self' | 'other';
  target?: 'self';
  resource?: string;
}

export interface TriggerDef {
  on: EventType;
  filter?: TriggerFilter;
  do: OpCall[];
}

export type CardTarget = 'none' | 'self' | 'party' | 'chosenEnemy' | 'allEnemies';

export interface CardDef {
  id: string;
  /** Character ID. */
  owner: string;
  cost: number;
  target: CardTarget;
  effects: OpCall[];
}

export interface CharacterDef {
  id: string;
  stats: { hp: number; attack: number; defense: number };
  cards: string[];
  passive?: { triggers: TriggerDef[] };
}

export interface EnemyDef {
  id: string;
  hp: number;
  triggers?: TriggerDef[];
}

export interface StatusDef {
  id: string;
  triggers?: TriggerDef[];
}

export interface RelicDef {
  id: string;
  triggers?: TriggerDef[];
}

export interface Registry {
  cards: Readonly<Record<string, CardDef>>;
  characters: Readonly<Record<string, CharacterDef>>;
  enemies: Readonly<Record<string, EnemyDef>>;
  statuses: Readonly<Record<string, StatusDef>>;
  relics: Readonly<Record<string, RelicDef>>;
  /** Bounded escape hatch: kit-specific operations, listed so their number stays visible. */
  customOps?: Readonly<Record<string, Operation>>;
}
