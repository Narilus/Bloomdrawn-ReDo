import type { Streams } from './rng.ts';

// Core rule numbers from docs/DESIGN.md ("Combat").
export const BASE_MANA = 6;
export const HAND_DRAW = 5;
export const HAND_MAX = 10;
export const MAX_CHAIN_DEPTH = 8;
export const GAUGE_MAX = 100;

export const COMBAT_STREAMS = ['shuffle', 'targeting', 'intents'] as const;
export type CombatStream = (typeof COMBAT_STREAMS)[number];

/** Instance IDs inside one combat: `m0`–`m3` party members, `e*` enemies, `r*` relics, `c*` cards. */
export type EntityId = string;

/** The shared party HP and Shield pool, as a damage or Shield target. */
export const PARTY: EntityId = 'party';

export interface StatusStack {
  status: string;
  stacks: number;
}

export interface Member {
  id: EntityId;
  character: string;
  statuses: StatusStack[];
  /** Ultimate gauge, 0 to GAUGE_MAX. Carries across the run. */
  gauge: number;
}

export interface Enemy {
  id: EntityId;
  enemy: string;
  hp: number;
  maxHp: number;
  shield: number;
  statuses: StatusStack[];
}

export interface Relic {
  id: EntityId;
  relic: string;
}

export interface CardInstance {
  uid: EntityId;
  card: string;
  /** The party member who owns this card. */
  owner: EntityId;
  /** Cost change while in hand (Ritual discounts and the like). Cleared when it leaves the hand. */
  costDelta?: number;
  /** Cleanups this card has been held through. Cleared when it leaves the hand. */
  held?: number;
}

export interface Piles {
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  graveyard: CardInstance[];
}

/** Plain JSON. Holds IDs only, never content objects. */
export interface CombatState {
  turn: number;
  phase: 'player' | 'enemy' | 'ended';
  outcome: 'victory' | 'defeat' | null;
  mana: number;
  maxMana: number;
  /** Taken off the next turn's refill, never below 0 Mana. */
  manaDebt: number;
  /** Mana paid for cards this turn. */
  manaSpent: number;
  /** Keys of once-per-turn triggers that have fired this turn. */
  usedThisTurn: string[];
  /** Effects waiting for the next card played this turn. Cleared at cleanup. */
  next: { costDelta: number; repeat: number };
  /** The party shares one HP pool and one Shield. */
  party: { hp: number; maxHp: number; shield: number };
  members: Member[];
  enemies: Enemy[];
  /** In acquisition order. */
  relics: Relic[];
  piles: Piles;
  /** Domain resources, pooled across the party. */
  resources: Record<string, number>;
  rng: Streams<CombatStream>;
  nextUid: number;
}

export const isAlive = (enemy: Enemy): boolean => enemy.hp > 0;
