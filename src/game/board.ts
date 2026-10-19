import { hexDistance, hexKey, neighbours, parseHex } from './hex.ts';

// The Labyrinth board (DESIGN.md "The Labyrinth", docs/notes/m3-labyrinth.md): hex tiles the party
// roams freely, fog of war, and the tile lifecycle. Pure and plain JSON; the run decides what a
// tile's content does when the party stops on it.

export type TileKind =
  | 'entrance'
  | 'path'
  | 'fight'
  | 'elite'
  | 'boss'
  | 'event'
  | 'shop'
  | 'camp'
  | 'symptom'
  | 'collapsing'
  /** A Collapsing tile after the party stepped off it: impassable. */
  | 'ruin'
  /** A Bloom pod swollen on a path tile from Fruiting on: a fight. */
  | 'pod';

export interface Tile {
  kind: TileKind;
  /** What the tile holds: an encounter, Event, Shop or Symptom card ID. */
  content?: string;
  /** A Symptom whose card was taken: free to pass from then on. */
  paid?: boolean;
}

export interface Board {
  /** Tiles by hex key. */
  tiles: Record<string, Tile>;
  /** Where the party stands. */
  at: string;
  /** Tiles whose layout is revealed, in reveal order. */
  seen: string[];
  /** Tiles whose contents are revealed, in reveal order. */
  known: string[];
}

/**
 * Fog distances (owner, 19 Oct): layout within 3 of anywhere the party has stood, so the edge of what
 * is known shows whether a tile leads on or ends; contents within 2; landmarks within 4.
 */
export const FOG = { layout: 3, contents: 2, landmarks: 4 } as const;

const LANDMARKS: readonly TileKind[] = ['shop', 'elite', 'boss'];
/** Marked as soon as their layout is revealed, and from then on. */
const ALWAYS_MARKED: readonly TileKind[] = ['collapsing', 'symptom', 'ruin', 'pod'];

/** A tile with a fight or a choice on it: walking stops there (owner, 19 Oct). */
export function stopsOn(tile: Tile): boolean {
  if (tile.kind === 'symptom') return !tile.paid;
  return ['fight', 'elite', 'boss', 'pod', 'event', 'shop', 'camp'].includes(tile.kind);
}

export function createBoard(tiles: Record<string, Tile>, start: string): Board {
  if (!tiles[start]) throw new Error(`No tile at the start "${start}".`);
  const board: Board = { tiles: structuredClone(tiles), at: start, seen: [], known: [] };
  reveal(board, start);
  return board;
}

/** What the player can see of a tile: undefined while its layout is fogged, 'unknown' until its contents are revealed. */
export function visibleKind(board: Board, key: string): TileKind | 'unknown' | undefined {
  const tile = board.tiles[key];
  if (!tile || !board.seen.includes(key)) return undefined;
  if (board.known.includes(key) || ALWAYS_MARKED.includes(tile.kind)) return tile.kind;
  return 'unknown';
}

/**
 * The shortest walk to a revealed tile, as the keys stepped on (ending with `to`), or undefined if
 * there is none. Only tiles whose contents are known are crossed, so a route never gives away a
 * fogged tile's contents or walks into one by surprise; a tile whose layout alone is revealed can
 * still be the destination. The route never crosses a Collapsing tile or an unpaid Symptom (the
 * player chooses those by clicking them), and goes around tiles that would stop it where it can.
 */
export function routeTo(board: Board, to: string): string[] | undefined {
  const target = board.tiles[to];
  if (to === board.at || !target || target.kind === 'ruin' || !board.seen.includes(to)) return undefined;
  const crossable = (key: string) => {
    const tile = board.tiles[key];
    if (!tile || !board.known.includes(key)) return false;
    return tile.kind !== 'ruin' && tile.kind !== 'collapsing' && !(tile.kind === 'symptom' && !tile.paid);
  };
  // A step onto a tile that would stop the walk costs far more than any detour.
  const cost = (key: string) => (key !== to && stopsOn(board.tiles[key]!) ? 1000 : 1);
  const best = new Map<string, number>([[board.at, 0]]);
  const from = new Map<string, string>();
  const open = [board.at];
  while (open.length > 0) {
    // Few tiles per board: a linear scan is simplest. Ties keep insertion order, so routes are stable.
    open.sort((a, b) => best.get(a)! - best.get(b)!);
    const here = open.shift()!;
    if (here === to) break;
    for (const next of neighbours(parseHex(here)).map(hexKey)) {
      if (next !== to && !crossable(next)) continue;
      if (next === to && !board.tiles[next]) continue;
      const total = best.get(here)! + cost(next);
      if (total >= (best.get(next) ?? Infinity)) continue;
      best.set(next, total);
      from.set(next, here);
      if (!open.includes(next)) open.push(next);
    }
  }
  if (!from.has(to)) return undefined;
  const steps: string[] = [];
  for (let key: string | undefined = to; key !== undefined && key !== board.at; key = from.get(key)) steps.unshift(key);
  return steps;
}

/**
 * Walks toward a tile: each step off a Collapsing tile ruins it, each arrival lifts the fog, and the
 * walk stops on the first tile the party must deal with. Returns the tiles actually stepped on, and
 * the board after each step so the walk can be shown tile by tile.
 */
export function walk(board: Board, to: string): { board: Board; steps: string[]; trail: Board[] } | undefined {
  const route = routeTo(board, to);
  if (!route) return undefined;
  let next = board;
  const steps: string[] = [];
  const trail: Board[] = [];
  for (const key of route) {
    next = structuredClone(next);
    const left = next.tiles[next.at]!;
    if (left.kind === 'collapsing') left.kind = 'ruin';
    next.at = key;
    steps.push(key);
    reveal(next, key);
    trail.push(next);
    if (stopsOn(next.tiles[key]!)) break;
  }
  return { board: next, steps, trail };
}

/** The party has dealt with the tile it stands on: fights, pods, Events and Camps become path; a Symptom is paid. */
export function resolveTile(board: Board): Board {
  const next = structuredClone(board);
  const tile = next.tiles[next.at]!;
  if (tile.kind === 'symptom') tile.paid = true;
  else if (['fight', 'elite', 'pod', 'event', 'camp'].includes(tile.kind)) {
    next.tiles[next.at] = { kind: 'path' };
  }
  return next;
}

function reveal(board: Board, at: string): void {
  const here = parseHex(at);
  for (const [key, tile] of Object.entries(board.tiles)) {
    const distance = hexDistance(here, parseHex(key));
    const landmark = LANDMARKS.includes(tile.kind) && distance <= FOG.landmarks;
    if ((distance <= FOG.layout || landmark) && !board.seen.includes(key)) board.seen.push(key);
    if ((distance <= FOG.contents || landmark) && !board.known.includes(key)) board.known.push(key);
  }
}
