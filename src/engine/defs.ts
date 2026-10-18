import type { EventType } from './events.ts';
import type { Formula } from './formula.ts';
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

/**
 * A number change applied by the pipeline in docs/ARCHITECTURE.md ("Modifiers and formulas").
 * `flat` adds on the source side; `outgoingMul` multiplies on the source side; `incomingMul`
 * multiplies on the target side (damage only).
 */
export interface ModifierDef {
  value: 'damage' | 'shield';
  step: 'flat' | 'outgoingMul' | 'incomingMul';
  amount: Formula;
}

/** Anything that can hold triggers and modifiers. */
export interface Hooks {
  triggers?: TriggerDef[];
  modifiers?: ModifierDef[];
}

export type CardTarget = 'none' | 'self' | 'party' | 'chosenEnemy' | 'allEnemies';
export type CardSlot = 'strike' | 'defense' | 'transcend' | 'flavourA' | 'flavourB';
/** Retain: stays in hand at cleanup. Ritual: a Spirit card that Retains. */
export type Keyword = 'retain' | 'ritual';

export interface CardDef {
  id: string;
  name: string;
  /** Character ID. */
  owner: string;
  /** Personal card slot; generated cards have none. */
  slot?: CardSlot;
  cost: number;
  target: CardTarget;
  keywords?: Keyword[];
  /** Ultimate charge for the owner, once per play (a repeated card does not charge again). */
  charge?: number;
  effects: OpCall[];
}

export interface CharacterDef {
  id: string;
  name: string;
  domain: string;
  stats: { hp: number; attack: number; defense: number };
  cards: string[];
  passive?: Hooks;
}

export interface EnemyDef extends Hooks {
  id: string;
  name: string;
  hp: number;
}

export interface StatusDef extends Hooks {
  id: string;
  stacking: 'add' | 'refresh' | 'highest';
}

export interface RelicDef extends Hooks {
  id: string;
}

export interface ResourceDef {
  id: string;
  /** Display name, e.g. "damage per hit". */
  name: string;
  /** Value at combat start; 0 if absent. */
  start?: number;
}

/**
 * A Domain's pooled resources and automatic hooks. Its hooks are active while any party member
 * belongs to it, and resolve after everyone else's triggers on the same event.
 */
export interface DomainDef {
  id: string;
  name: string;
  resources: ResourceDef[];
  triggers?: TriggerDef[];
}

export interface Registry {
  cards: Readonly<Record<string, CardDef>>;
  characters: Readonly<Record<string, CharacterDef>>;
  enemies: Readonly<Record<string, EnemyDef>>;
  statuses: Readonly<Record<string, StatusDef>>;
  relics: Readonly<Record<string, RelicDef>>;
  domains: Readonly<Record<string, DomainDef>>;
  /** Bounded escape hatch: kit-specific operations, listed so their number stays visible. */
  customOps?: Readonly<Record<string, Operation>>;
}
