import {
  createStreams,
  nextInt,
  shuffleInPlace,
  type CombatSetup,
  type CombatState,
  type MotifDef,
  type Registry,
  type Streams,
} from '../engine/index.ts';
import { bloomTick, stageOf } from './bloom.ts';
import { resolveTile, stopsOn, walk, type Board } from './board.ts';
import { generateBoard, M3_LABYRINTH, type LabyrinthDef } from './labyrinth.ts';

// A run through the Labyrinth (docs/notes/m3-labyrinth.md): the party walks the board, fights
// where it stops on a fight, and wins at the Boss. Party HP, ultimate gauges and relics carry from
// fight to fight. Won fights and Events tick the Bloom clock (src/game/bloom.ts), which scales the
// enemies of later fights. Pure and seeded, like the engine. Shops, Camps, Events and Symptoms get
// their rules in M3.5–M3.6; until then the party can only look at them and move on.

export const EXPEDITION_STREAMS = ['fights', 'rewards', 'bloom'] as const;
type ExpeditionStream = (typeof EXPEDITION_STREAMS)[number];

export interface ExpeditionDef {
  board: LabyrinthDef;
  /** Relics an elite may offer. */
  relicPool: string[];
  /** How many relics an elite offers to choose from. */
  offer: number;
}

/** Plain JSON, like combat state. */
export interface Expedition {
  party: string[];
  board: Board;
  /**
   * map: choosing where to walk. tile: stopped on a Shop, Camp, Event or Symptom. fight: stopped
   * on a fight. reward: choosing an elite's relic. won and lost end the run.
   */
  phase: 'map' | 'tile' | 'fight' | 'reward' | 'won' | 'lost';
  /** The tile the party stepped from last, for turning back from a Symptom. */
  from?: string;
  /** The current fight's combat seed. */
  fightSeed?: number;
  hp: number | null;
  gauges: number[];
  /** Bloom clock ticks so far. */
  clock: number;
  relics: string[];
  offered: string[];
  rng: Streams<ExpeditionStream>;
}

export function startExpedition(seed: number, party: string[], def: ExpeditionDef, motifs: Readonly<Record<string, MotifDef>>): Expedition {
  return {
    party,
    board: generateBoard(seed, def.board, motifs),
    phase: 'map',
    hp: null,
    gauges: party.map(() => 0),
    clock: 0,
    relics: [],
    offered: [],
    rng: createStreams(seed, EXPEDITION_STREAMS),
  };
}

/**
 * Walks toward a tile. Returns the expedition after each step, so the walk can be shown tile by
 * tile; the last one has stopped and says what happens next. Undefined if the party can't go there.
 */
export function move(exp: Expedition, to: string): Expedition[] | undefined {
  if (!canMove(exp)) return undefined;
  const result = walk(exp.board, to);
  if (!result) return undefined;
  let from = exp.board.at;
  const states = result.trail.map((board) => {
    const state: Expedition = { ...structuredClone(exp), board, from, phase: 'map' };
    delete state.fightSeed;
    from = board.at;
    return state;
  });
  const last = states.at(-1)!;
  arrive(last);
  return states;
}

/** The party can walk from the map, or away from a tile it has looked at (but not past an unpaid Symptom). */
export function canMove(exp: Expedition): boolean {
  if (exp.phase === 'map') return true;
  const tile = exp.board.tiles[exp.board.at];
  return exp.phase === 'tile' && !(tile?.kind === 'symptom' && !tile.paid);
}

/** What stopping on the current tile means. */
function arrive(exp: Expedition): void {
  const tile = exp.board.tiles[exp.board.at]!;
  if (!stopsOn(tile)) exp.phase = 'map';
  else if (tile.kind === 'fight' || tile.kind === 'elite' || tile.kind === 'boss') {
    exp.phase = 'fight';
    exp.fightSeed = nextInt(exp.rng, 'fights', 2 ** 31);
  } else exp.phase = 'tile';
}

/** The combat setup for the fight the party is standing on, scaled by the Bloom's stage. */
export function expeditionFight(exp: Expedition, registry: Registry): CombatSetup {
  const tile = exp.board.tiles[exp.board.at];
  const encounter = registry.encounters[tile?.content ?? ''];
  if (exp.phase !== 'fight' || !encounter) throw new Error('There is no fight here.');
  const setup: CombatSetup = { seed: exp.fightSeed ?? 0, party: exp.party, enemies: encounter.enemies, relics: exp.relics, gauges: exp.gauges };
  if (exp.hp !== null) setup.partyHp = exp.hp;
  const scale = stageOf(exp.clock).enemyScale;
  if (scale > 0) setup.enemyScale = scale;
  return setup;
}

/** Carries a finished fight back: a loss ends the run, the Boss wins it, an elite offers relics. A won fight ticks the clock. */
export function finishExpeditionFight(exp: Expedition, combat: CombatState, def: ExpeditionDef): Expedition {
  if (exp.phase !== 'fight' || combat.phase !== 'ended') throw new Error('The fight is not over.');
  const next = structuredClone(exp);
  delete next.fightSeed;
  next.hp = combat.party.hp;
  next.gauges = combat.members.map((m) => m.gauge);
  const kind = exp.board.tiles[exp.board.at]?.kind;
  if (combat.outcome === 'defeat') next.phase = 'lost';
  else if (kind === 'boss') next.phase = 'won';
  else {
    next.board = resolveTile(next.board);
    next.phase = 'map';
    tick(next, def);
    if (kind === 'elite') {
      const pool = def.relicPool.filter((id) => !exp.relics.includes(id));
      shuffleInPlace(pool, next.rng, 'rewards');
      next.offered = pool.slice(0, def.offer);
      if (next.offered.length > 0) next.phase = 'reward';
    }
  }
  return next;
}

/** Takes one offered relic (or none) and returns to the map. */
export function chooseExpeditionRelic(exp: Expedition, relic: string | null): Expedition {
  if (exp.phase !== 'reward') throw new Error('Nothing is on offer.');
  if (relic !== null && !exp.offered.includes(relic)) throw new Error(`"${relic}" was not offered.`);
  const next = structuredClone(exp);
  if (relic !== null) next.relics.push(relic);
  next.offered = [];
  next.phase = 'map';
  return next;
}

/**
 * Done with the tile the party stands on. An Event is used up and ticks the clock, and a Symptom is
 * paid (M3.6 adds their effects and the card); a Shop or Camp stays for later.
 */
export function leaveTile(exp: Expedition, def: ExpeditionDef): Expedition {
  if (exp.phase !== 'tile') throw new Error('There is nothing here to leave.');
  const kind = exp.board.tiles[exp.board.at]?.kind;
  const next = structuredClone(exp);
  if (kind === 'event' || kind === 'symptom') next.board = resolveTile(next.board);
  if (kind === 'event') tick(next, def);
  next.phase = 'map';
  return next;
}

/** One Bloom clock tick, and what the new count does to the board. */
function tick(exp: Expedition, def: ExpeditionDef): void {
  exp.board = bloomTick(exp.board, exp.clock, exp.rng, 'bloom', def.board.encounters);
  exp.clock += 1;
}

/** Steps back off an unpaid Symptom to the tile the party came from, if it is still there. */
export function turnBack(exp: Expedition): Expedition | undefined {
  const back = exp.from === undefined ? undefined : exp.board.tiles[exp.from];
  if (exp.phase !== 'tile' || !back || back.kind === 'ruin') return undefined;
  const next = structuredClone(exp);
  next.board.at = exp.from!;
  delete next.from;
  next.phase = 'map';
  return next;
}

/** The M3 test (owner, 19 Oct): one board, with an elite's relic pick from the M2 relics. */
export const M3_EXPEDITION: ExpeditionDef = {
  board: M3_LABYRINTH,
  relicPool: [
    'relic.brass-thimble',
    'relic.seed-packet',
    'relic.cracked-reliquary',
    'relic.vigil-wax',
    'relic.midwifes-shears',
    'relic.choir-bell',
    'relic.blooming-coin',
  ],
  offer: 3,
};
