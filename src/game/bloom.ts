import { nextInt, type Streams } from '../engine/index.ts';
import type { Board } from './board.ts';

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
