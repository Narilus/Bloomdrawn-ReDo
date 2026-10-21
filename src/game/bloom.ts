import { nextInt, type Streams } from '../engine/index.ts';
import type { Board } from './board.ts';
import { hexDistance, parseHex } from './hex.ts';

// The Bloom clock (DESIGN.md "The Bloom clock", docs/notes/m3-labyrinth.md): fights, Events and
// using a Camp tick it, and each stage makes the Labyrinth harder. The numbers are placeholders
// for tuning with the owner.

export type BloomStage = 'dormant' | 'seeded' | 'rooted' | 'flowering' | 'fruiting';

export interface StageDef {
  id: BloomStage;
  name: string;
  /** The tick count the stage starts at. */
  from: number;
  /** Percent added to enemies' HP and damage in fights started at this stage. */
  enemyScale: number;
  /** Percent added to the Obols a fight started at this stage gives. */
  obolBonus: number;
}

export const BLOOM_STAGES: readonly StageDef[] = [
  { id: 'dormant', name: 'Dormant', from: 0, enemyScale: 0, obolBonus: 0 },
  { id: 'seeded', name: 'Seeded', from: 3, enemyScale: 10, obolBonus: 10 },
  { id: 'rooted', name: 'Rooted', from: 6, enemyScale: 20, obolBonus: 20 },
  { id: 'flowering', name: 'Flowering', from: 9, enemyScale: 35, obolBonus: 35 },
  { id: 'fruiting', name: 'Fruiting', from: 12, enemyScale: 50, obolBonus: 50 },
];

/** On reaching Flowering, each normal fight whose contents are still unseen draws from the elite roster with a 1 in this chance. */
export const FLOWERING_ELITE_ODDS = 3;

/**
 * Fruiting's Bloom nodes (owner, 20 Oct; numbers are placeholders): one appears after every 6–10
 * tiles walked (rolled each time), on a path tile within 3 of the party, ahead of it where it can.
 * Landing on one forces a choice: a fight from the normal pool, a 50/50 gamble to lose or heal 10%
 * of current HP, or its Symptom card.
 */
export const BLOOM_NODES = { every: [6, 10], within: 3, gamble: 10 } as const;

export function stageOf(clock: number): StageDef {
  return BLOOM_STAGES.findLast((s) => clock >= s.from) ?? BLOOM_STAGES[0]!;
}

/** Ticks until the next stage, or undefined at the last one. */
export function ticksToNext(clock: number): number | undefined {
  const next = BLOOM_STAGES.find((s) => s.from > clock);
  return next && next.from - clock;
}

export function reached(clock: number, stage: BloomStage): boolean {
  return clock >= BLOOM_STAGES.find((s) => s.id === stage)!.from;
}

/** What one tick does to the board, after the count has moved from `before` to `before + 1`. */
export function bloomTick<K extends string>(
  board: Board,
  before: number,
  rng: Streams<K>,
  stream: K,
  pools: { elite: readonly string[] },
): Board {
  const next = structuredClone(board);
  if (!reached(before, 'flowering') && reached(before + 1, 'flowering') && pools.elite.length > 0) {
    for (const [key, tile] of Object.entries(next.tiles)) {
      if (tile.kind === 'fight' && !next.known.includes(key) && nextInt(rng, stream, FLOWERING_ELITE_ODDS) === 0) {
        tile.content = pools.elite[nextInt(rng, stream, pools.elite.length)]!;
      }
    }
  }
  return next;
}

/** The Boss tile, once the Bloom shows the way (Flowering on). */
export function bossDirection(board: Board, clock: number): string | undefined {
  if (!reached(clock, 'flowering')) return undefined;
  return Object.keys(board.tiles).find((key) => board.tiles[key]!.kind === 'boss');
}

/** Tiles to walk until the next Bloom node. */
export function bloomNodeDue<K extends string>(rng: Streams<K>, stream: K): number {
  const [low, high] = BLOOM_NODES.every;
  return low + nextInt(rng, stream, high - low + 1);
}

/**
 * Puts a Bloom node on a path tile near the party, holding a fight from the normal pool and a
 * Symptom card. It goes ahead of the party (nearer the Boss) where there is a free tile. Undefined
 * if there is no room.
 */
export function spawnBloomNode<K extends string>(
  board: Board,
  rng: Streams<K>,
  stream: K,
  pools: { fight: readonly string[]; symptoms: readonly string[] },
): Board | undefined {
  const here = parseHex(board.at);
  const boss = Object.keys(board.tiles).find((key) => board.tiles[key]!.kind === 'boss');
  const toBoss = (key: string) => (boss === undefined ? 0 : hexDistance(parseHex(key), parseHex(boss)));
  const near = Object.keys(board.tiles).filter(
    (key) => key !== board.at && board.tiles[key]!.kind === 'path' && hexDistance(here, parseHex(key)) <= BLOOM_NODES.within,
  );
  const ahead = near.filter((key) => toBoss(key) < toBoss(board.at));
  const spots = ahead.length > 0 ? ahead : near;
  if (spots.length === 0 || pools.fight.length === 0 || pools.symptoms.length === 0) return undefined;
  const next = structuredClone(board);
  const at = spots[nextInt(rng, stream, spots.length)]!;
  next.tiles[at] = {
    kind: 'bloom',
    content: pools.fight[nextInt(rng, stream, pools.fight.length)]!,
    card: pools.symptoms[nextInt(rng, stream, pools.symptoms.length)]!,
  };
  return next;
}
