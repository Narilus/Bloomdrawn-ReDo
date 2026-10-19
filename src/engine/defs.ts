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
  /** Raised by a card or ultimate itself, not by another trigger. */
  direct?: true;
  /** For `cardPlayed`: only cards in these personal slots. */
  slots?: CardSlot[];
}

export interface TriggerDef {
  on: EventType;
  filter?: TriggerFilter;
  /** `turn`: fires at most once per turn. */
  once?: 'turn';
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
/** Retain: stays in hand at cleanup. Ritual: a Spirit card that Retains. Exhaust: goes to the Graveyard when played. */
export type Keyword = 'retain' | 'ritual' | 'exhaust';

export interface CardDef {
  id: string;
  name: string;
  /** Character ID. */
  owner: string;
  /** Personal card slot; generated cards have none. */
  slot?: CardSlot;
  /** Made during combat by a card (createCard), not dealt into the deck. */
  generated?: boolean;
  cost: number;
  target: CardTarget;
  keywords?: Keyword[];
  /**
   * Authored rules text. `{path}` slots point at formulas inside this card, e.g.
   * `{effects.0.amount}`, and show live numbers. Without it, text is generated from the effects.
   */
  text?: string;
  /** Ultimate charge for the owner, once per play (a repeated card does not charge again). */
  charge?: number;
  effects: OpCall[];
}

/**
 * A passive: always combat- or run-scoped. Its text slots point inside it, e.g.
 * `{triggers.0.do.0.amount}`. Content requires the name, scope and text; engine fixtures may omit them.
 */
export interface PassiveDef extends Hooks {
  name?: string;
  scope?: 'combat' | 'run';
  text?: string;
}

/**
 * Fired at a full gauge by a deliberate confirm; costs no Mana. Its text slots point inside it.
 * Once its owner Transcends, `transcended` replaces it for the rest of the combat.
 */
export interface UltimateDef {
  name: string;
  text: string;
  effects: OpCall[];
  transcended?: { text: string; effects: OpCall[] };
}

export interface CharacterDef {
  id: string;
  name: string;
  domain: string;
  stats: { hp: number; attack: number; defense: number };
  cards: string[];
  passive?: PassiveDef;
  ultimate?: UltimateDef;
}

/** One thing an enemy can do on its turn, shown in advance with its exact numbers. */
export interface IntentDef {
  id: string;
  name: string;
  effects: OpCall[];
}

export interface EnemyDef extends Hooks {
  id: string;
  name: string;
  hp: number;
  /** Used in order, then from the start again. An enemy without intents does nothing. */
  intents?: IntentDef[];
  /** `resistsControl`: elites and bosses turn Stun and Delay into Falter. */
  traits?: 'resistsControl'[];
  /** How large it stands on the field (presentation only). */
  size?: 'small' | 'normal' | 'large';
}

/** A fight: which enemies, in slot order, with optional HP overrides for this encounter. */
export interface EncounterDef {
  id: string;
  tier: 'normal' | 'elite' | 'boss';
  enemies: EnemyEntry[];
}

export type EnemyEntry = string | { enemy: string; hp: number };

export interface StatusDef extends Hooks {
  id: string;
  stacking: 'add' | 'refresh' | 'highest';
  /** Control: the bearer skips its next action, then this status is removed. `advance` loses that intent (Stun); `hold` keeps it shown for next turn (Delay). */
  skipsAction?: 'advance' | 'hold';
  /** On a bearer that resists control, this status is applied instead (Stun and Delay become Falter). */
  resistedAs?: string;
  /** Removed right after the bearer's next action (Falter). */
  endsAfterAction?: boolean;
  /** A HUD icon key, and the badge tooltip's plain-language rule. */
  icon?: string;
  help?: string;
}

/** Content requires the name, tier and text; engine fixtures may omit them. */
export interface RelicDef extends Hooks {
  id: string;
  name?: string;
  tier?: 'common' | 'uncommon' | 'rare' | 'cursed';
  /** Plain rules text for its tooltip. */
  text?: string;
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
  /**
   * The HUD badge: a count, and optionally damage for each one (shown as count × each = total).
   * `icon` names a HUD icon; `help` is the tooltip's plain-language rule.
   */
  counter?: { label: string; icon?: string; help?: string; count: Formula; each?: Formula };
}

export interface Registry {
  cards: Readonly<Record<string, CardDef>>;
  characters: Readonly<Record<string, CharacterDef>>;
  enemies: Readonly<Record<string, EnemyDef>>;
  statuses: Readonly<Record<string, StatusDef>>;
  relics: Readonly<Record<string, RelicDef>>;
  domains: Readonly<Record<string, DomainDef>>;
  encounters: Readonly<Record<string, EncounterDef>>;
  /** Bounded escape hatch: kit-specific operations, listed so their number stays visible. */
  customOps?: Readonly<Record<string, Operation>>;
}
