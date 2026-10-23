import { createStreams, nextInt, shuffleInPlace, type MotifDef, type Streams } from '../engine/index.ts';
import { createBoard, type Board, type Tile, type TileKind } from './board.ts';
import { hexKey, neighbours, parseHex, type Hex } from './hex.ts';
import { parseMotif, rotate, type ParsedMotif, type Role } from './motif.ts';

// One Labyrinth board per run, stitched from motifs (DESIGN.md "Motifs", docs/notes/m3-labyrinth.md):
// route motifs chain from the entrance to the Boss, side motifs hang off sockets, and the run seed
// fills each content role. Motifs touch only at their joints, and a joint touches nothing but plain
// path, so no fight, choice or gate gains a neighbour its motif didn't draw. A board that could
// strand the player is rerolled.

export const BOARD_STREAMS = ['layout', 'content'] as const;
type BoardStream = (typeof BOARD_STREAMS)[number];

export interface LabyrinthDef {
  /** Route motifs in order from the entrance to the Boss, each drawn from its pool. */
  route: string[][];
  /** Side motifs, each drawn from its pool and hung off a free socket. */
  sides: string[][];
  /** Encounters for each fight role; a pool is drawn without repeats while it lasts. */
  encounters: { fight: string[]; elite: string[]; boss: string[] };
  /** Events for event tiles, drawn the same way. */
  events: string[];
  /** Symptom cards for Symptom tiles, and for Events and Bloom nodes that offer one. */
  symptoms: string[];
}

const MAX_ATTEMPTS = 200;
const PLAIN: readonly Role[] = ['joint', 'exit', 'socket', 'path'];
/** Route motifs are drawn heading east; they may turn up to a sixth either way, so the route never doubles back. */
const ROUTE_TURNS = [0, 1, 5];
const SIDE_TURNS = [0, 1, 2, 3, 4, 5];

const KIND_OF: Readonly<Record<Role, TileKind>> = {
  joint: 'path',
  exit: 'path',
  socket: 'path',
  path: 'path',
  fight: 'fight',
  elite: 'elite',
  boss: 'boss',
  event: 'event',
  shop: 'shop',
  camp: 'camp',
  symptom: 'symptom',
  collapsing: 'collapsing',
};

/** Builds a board from the seed. Throws if no valid board turns up, which means the motifs need fixing. */
export function generateBoard(seed: number, def: LabyrinthDef, motifs: Readonly<Record<string, MotifDef>>): Board {
  const rng = createStreams(seed, BOARD_STREAMS);
  const parsed = new Map<string, ParsedMotif>();
  const motif = (id: string) => {
    if (!parsed.has(id)) {
      const m = motifs[id];
      if (!m) throw new Error(`Unknown motif "${id}".`);
      parsed.set(id, parseMotif(m.rows));
    }
    return parsed.get(id)!;
  };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const roles = layOut(def, motif, rng);
    if (!roles) continue;
    const board = createBoard(fill(roles, def, rng), '0,0');
    if (!findStranding(board)) return board;
  }
  throw new Error(`No valid board in ${MAX_ATTEMPTS} attempts from seed ${seed}.`);
}

/** Places every motif, or returns undefined if one doesn't fit. */
function layOut(def: LabyrinthDef, motif: (id: string) => ParsedMotif, rng: Streams<BoardStream>): Map<string, Role> | undefined {
  const placed = new Map<string, Role>();
  const sockets: string[] = [];
  let exit: string | undefined;
  for (const [i, pool] of def.route.entries()) {
    const m = motif(pick(pool, rng));
    const spots = i === 0 ? [{ at: { q: 0, r: 0 }, turns: 0 }] : candidates(exit === undefined ? [] : [exit], placed, ROUTE_TURNS, rng);
    const done = spots.find(({ at, turns }) => tryPlace(m, at, turns, placed, i === 0 ? undefined : exit));
    if (!done) return undefined;
    const move = (key: string) => hexKey(translate(rotate(parseHex(key), done.turns), done.at));
    exit = m.exit === undefined ? undefined : move(m.exit);
    sockets.push(...m.sockets.map(move));
  }
  for (const pool of def.sides) {
    const m = motif(pick(pool, rng));
    const done = candidates(sockets, placed, SIDE_TURNS, rng).find(({ at, turns, anchor }) => tryPlace(m, at, turns, placed, anchor));
    if (!done) return undefined;
    sockets.splice(sockets.indexOf(done.anchor), 1);
  }
  return placed;
}

/** Where a motif's joint could go next to one of the anchors, in every allowed turn, shuffled. */
function candidates(anchors: string[], placed: Map<string, Role>, turns: number[], rng: Streams<BoardStream>) {
  const out: { at: Hex; turns: number; anchor: string }[] = [];
  for (const anchor of anchors) {
    for (const at of neighbours(parseHex(anchor))) {
      if (placed.has(hexKey(at))) continue;
      for (const t of turns) out.push({ at, turns: t, anchor });
    }
  }
  shuffleInPlace(out, rng, 'layout');
  return out;
}

/**
 * Places a motif with its joint at `at`, turned, if it fits: no tile may land on or next to a
 * placed tile, except the joint, which may touch its anchor and plain path. (On a hex board every
 * free neighbour of a socket in a lane also touches the lane beside it.)
 */
function tryPlace(m: ParsedMotif, at: Hex, turns: number, placed: Map<string, Role>, anchor: string | undefined): boolean {
  const tiles = Object.entries(m.tiles).map(([key, role]) => ({
    key: hexKey(translate(rotate(parseHex(key), turns), at)),
    role,
    joint: key === '0,0',
  }));
  for (const tile of tiles) {
    if (placed.has(tile.key)) return false;
    for (const n of neighbours(parseHex(tile.key)).map(hexKey)) {
      const role = placed.get(n);
      if (role !== undefined && !(tile.joint && (n === anchor || PLAIN.includes(role)))) return false;
    }
  }
  for (const tile of tiles) placed.set(tile.key, tile.role);
  return true;
}

/** Turns roles into tiles, filling fights, elites, the Boss and Events from their pools, and each Symptom with its card. */
function fill(roles: Map<string, Role>, def: LabyrinthDef, rng: Streams<BoardStream>): Record<string, Tile> {
  const draws: Partial<Record<Role, () => string | undefined>> = {
    fight: drawer(def.encounters.fight, rng),
    elite: drawer(def.encounters.elite, rng),
    boss: drawer(def.encounters.boss, rng),
    event: drawer(def.events, rng),
  };
  const symptoms = drawer(def.symptoms, rng);
  const tiles: Record<string, Tile> = {};
  for (const [key, role] of roles) {
    const tile: Tile = { kind: key === '0,0' ? 'entrance' : KIND_OF[role] };
    const content = draws[role]?.();
    if (content !== undefined) tile.content = content;
    const card = role === 'symptom' ? symptoms() : undefined;
    if (card !== undefined) tile.card = card;
    tiles[key] = tile;
  }
  return tiles;
}

/** Draws from a pool without repeats until it runs out, then starts over. */
function drawer(pool: string[], rng: Streams<BoardStream>): () => string | undefined {
  let bag: string[] = [];
  return () => {
    if (pool.length === 0) return undefined;
    if (bag.length === 0) {
      bag = [...pool];
      shuffleInPlace(bag, rng, 'content');
    }
    return bag.pop();
  };
}

const pick = (pool: string[], rng: Streams<BoardStream>) => {
  const id = pool[nextInt(rng, 'layout', pool.length)];
  if (id === undefined) throw new Error('An empty motif pool.');
  return id;
};
const translate = (h: Hex, by: Hex): Hex => ({ q: h.q + by.q, r: h.r + by.r });

/**
 * Replays every way the party could move, including every order of stepping off Collapsing tiles.
 * Returns a reachable position, with the tiles ruined on the way there, from which the Boss can no
 * longer be reached; undefined if there is none. Symptoms count as passable, since taking the card
 * is always allowed.
 */
export function findStranding(board: Board): { at: string; ruined: string[] } | undefined {
  const boss = Object.keys(board.tiles).find((key) => board.tiles[key]!.kind === 'boss');
  if (boss === undefined) return { at: board.at, ruined: [] };
  const open = (key: string, ruined: ReadonlySet<string>) => {
    const tile = board.tiles[key];
    return tile !== undefined && tile.kind !== 'ruin' && !ruined.has(key);
  };
  const seen = new Set<string>();
  const queue: { at: string; ruined: string[] }[] = [{ at: board.at, ruined: [] }];
  while (queue.length > 0) {
    const state = queue.shift()!;
    const id = `${state.at}|${state.ruined.join(';')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const ruined = new Set(state.ruined);
    if (!reaches(state.at, boss, (key) => open(key, ruined))) return state;
    if (state.at === boss) continue;
    // Stepping off a Collapsing tile ruins it.
    const after = board.tiles[state.at]!.kind === 'collapsing' ? [...state.ruined, state.at].sort() : state.ruined;
    const afterSet = new Set(after);
    for (const n of neighbours(parseHex(state.at)).map(hexKey)) {
      if (open(n, afterSet)) queue.push({ at: n, ruined: after });
    }
  }
  return undefined;
}

function reaches(from: string, to: string, open: (key: string) => boolean): boolean {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    if (here === to) return true;
    for (const n of neighbours(parseHex(here)).map(hexKey)) {
      if (!seen.has(n) && open(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

/**
 * The M3 board (docs/notes/m3-labyrinth.md, owner, 19 Oct): start, a fork, the temptation loop and
 * the Boss approach, with four side motifs. Until M4's Boss, the Boss tile holds an M2 elite.
 */
export const M3_LABYRINTH: LabyrinthDef = {
  route: [['motif.start-gate'], ['motif.fork-elite', 'motif.fork-elite-event'], ['motif.temptation-loop'], ['motif.boss-approach']],
  sides: [['motif.elite-branch'], ['motif.camp-nook'], ['motif.event-alcove'], ['motif.grove-fight', 'motif.grove-stall']],
  encounters: {
    fight: ['encounter.hound', 'encounter.roots-and-smoke', 'encounter.pods-and-lantern', 'encounter.two-hounds'],
    elite: ['encounter.thorn-wall', 'encounter.hound-mother'],
    boss: ['encounter.hollow-abbess'],
  },
  events: ['event.survey-pack', 'event.censer', 'event.kneeling-gardener', 'event.seed-vault'],
  symptoms: ['symptom.fevered-pulse', 'symptom.sweet-rot', 'symptom.grafted-hand', 'symptom.pollen-lung'],
};
