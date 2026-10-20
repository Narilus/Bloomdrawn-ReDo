import {
  createStreams,
  nextInt,
  shuffleInPlace,
  type CombatSetup,
  type CombatState,
  type MotifDef,
  type Registry,
  type RelicDef,
  type Streams,
} from '../engine/index.ts';
import { bloomTick, stageOf, type BloomStage } from './bloom.ts';
import { resolveTile, stopsOn, walk, type Board } from './board.ts';
import { generateBoard, M3_LABYRINTH, type LabyrinthDef } from './labyrinth.ts';

// A run through the Labyrinth (docs/notes/m3-labyrinth.md): the party walks the board, fights
// where it stops on a fight, and wins at the Boss. Party HP, ultimate gauges and relics carry from
// fight to fight. Won fights and Events tick the Bloom clock (src/game/bloom.ts), which scales the
// enemies of later fights. Won fights give Obols, spent at Shops. Pure and seeded, like the engine.
// Camps, Events and Symptoms get their rules in M3.6; until then the party can only look at them
// and move on.

export const EXPEDITION_STREAMS = ['fights', 'rewards', 'bloom', 'shops'] as const;
type ExpeditionStream = (typeof EXPEDITION_STREAMS)[number];

export type RelicTier = NonNullable<RelicDef['tier']>;
/** A Shop offers one relic of each tier, in this order (owner). */
export const SHOP_TIERS: readonly RelicTier[] = ['common', 'uncommon', 'rare', 'cursed'];

export interface ExpeditionDef {
  board: LabyrinthDef;
  /** Relics an elite or a Shop may offer. */
  relicPool: string[];
  /** How many relics an elite offers to choose from. */
  offer: number;
  /** Obols for winning a fight, before the Bloom's bonus. */
  obols: { fight: number; elite: number };
  shop: {
    /** A relic's price by its tier. */
    prices: Record<RelicTier, number>;
    /** Heal a share of max HP, once per Shop. */
    mend: { price: number; percent: number };
  };
}

/** One Shop's stock: rolled on first entry, then kept all run with its prices and what is sold. */
export interface ShopStock {
  relics: { relic: string; price: number; sold?: true }[];
  mend: { price: number; percent: number; used?: true };
}

/** Plain JSON, like combat state. */
export interface Expedition {
  party: string[];
  board: Board;
  /**
   * map: choosing where to walk. tile: stopped on a Shop, Camp, Event or Symptom. fight: stopped
   * on a fight. reward: the Victory panel after a won fight, with an elite's relic pick. won and
   * lost end the run.
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
  obols: number;
  /** What the last won fight gave, for the Victory panel: Obols, including the bonus (percent) of the Bloom stage it started at. */
  spoils?: { obols: number; bonus: number; stage: BloomStage };
  /** Each Shop's stock by tile key, once entered. */
  shops: Record<string, ShopStock>;
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
    obols: 0,
    shops: {},
    rng: createStreams(seed, EXPEDITION_STREAMS),
  };
}

/**
 * Walks toward a tile. Returns the expedition after each step, so the walk can be shown tile by
 * tile; the last one has stopped and says what happens next. Undefined if the party can't go there.
 */
export function move(exp: Expedition, to: string, def: ExpeditionDef, registry: Registry): Expedition[] | undefined {
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
  arrive(last, def, registry);
  return states;
}

/** The party can walk from the map, or away from a tile it has looked at (but not past an unpaid Symptom). */
export function canMove(exp: Expedition): boolean {
  if (exp.phase === 'map') return true;
  const tile = exp.board.tiles[exp.board.at];
  return exp.phase === 'tile' && !(tile?.kind === 'symptom' && !tile.paid);
}

/** What stopping on the current tile means. A Shop entered for the first time rolls its stock. */
function arrive(exp: Expedition, def: ExpeditionDef, registry: Registry): void {
  const tile = exp.board.tiles[exp.board.at]!;
  if (!stopsOn(tile)) exp.phase = 'map';
  else if (tile.kind === 'fight' || tile.kind === 'elite' || tile.kind === 'boss') {
    exp.phase = 'fight';
    exp.fightSeed = nextInt(exp.rng, 'fights', 2 ** 31);
  } else exp.phase = 'tile';
  if (tile.kind === 'shop') exp.shops[exp.board.at] ??= rollShop(exp, def, registry);
}

/** One relic of each tier from those not owned or stocked by another Shop (a tier with none left stays empty), and Mend. */
function rollShop(exp: Expedition, def: ExpeditionDef, registry: Registry): ShopStock {
  const taken = new Set([...exp.relics, ...Object.values(exp.shops).flatMap((s) => s.relics.map((r) => r.relic))]);
  const relics = SHOP_TIERS.flatMap((tier) => {
    const pool = def.relicPool.filter((id) => registry.relics[id]?.tier === tier && !taken.has(id));
    if (pool.length === 0) return [];
    return [{ relic: pool[nextInt(exp.rng, 'shops', pool.length)]!, price: def.shop.prices[tier] }];
  });
  return { relics, mend: { ...def.shop.mend } };
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

/**
 * Carries a finished fight back: a loss ends the run and the Boss wins it. Any other win gives
 * Obols (more at later Bloom stages), ticks the clock and opens the Victory panel, where an elite
 * also offers relics.
 */
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
    // The stage the fight started at, before its own tick.
    const { obolBonus: bonus, id: stage } = stageOf(exp.clock);
    const obols = Math.floor(((kind === 'elite' ? def.obols.elite : def.obols.fight) * (100 + bonus)) / 100);
    next.obols += obols;
    next.spoils = { obols, bonus, stage };
    next.board = resolveTile(next.board);
    next.phase = 'reward';
    tick(next, def);
    if (kind === 'elite') {
      const pool = def.relicPool.filter((id) => !exp.relics.includes(id));
      shuffleInPlace(pool, next.rng, 'rewards');
      next.offered = pool.slice(0, def.offer);
    }
  }
  return next;
}

/** Closes the Victory panel, taking one offered relic (or none), and returns to the map. */
export function chooseExpeditionRelic(exp: Expedition, relic: string | null): Expedition {
  if (exp.phase !== 'reward') throw new Error('Nothing is on offer.');
  if (relic !== null && !exp.offered.includes(relic)) throw new Error(`"${relic}" was not offered.`);
  const next = structuredClone(exp);
  if (relic !== null) next.relics.push(relic);
  next.offered = [];
  delete next.spoils;
  next.phase = 'map';
  return next;
}

/** The party's max HP: its members' HP added up, as combat starts it. */
export function expeditionMaxHp(exp: Expedition, registry: Registry): number {
  return exp.party.reduce((sum, id) => sum + (registry.characters[id]?.stats.hp ?? 0), 0);
}

/** The stock of the Shop the party is in, if it is in one. */
export function shopHere(exp: Expedition): ShopStock | undefined {
  return exp.phase === 'tile' ? exp.shops[exp.board.at] : undefined;
}

/** Why a relic can't be bought here now, or undefined if it can. */
export function cannotBuy(exp: Expedition, relic: string): string | undefined {
  const offer = shopHere(exp)?.relics.find((r) => r.relic === relic);
  if (!offer) return 'Not for sale here.';
  if (offer.sold) return 'Sold.';
  if (exp.relics.includes(relic)) return 'Already owned.';
  if (exp.obols < offer.price) return 'Not enough Obols.';
  return undefined;
}

export function buyRelic(exp: Expedition, relic: string): Expedition {
  const reason = cannotBuy(exp, relic);
  if (reason) throw new Error(reason);
  const next = structuredClone(exp);
  const offer = next.shops[next.board.at]!.relics.find((r) => r.relic === relic)!;
  offer.sold = true;
  next.obols -= offer.price;
  next.relics.push(relic);
  return next;
}

/** The HP Mend would heal here now: its share of max HP, up to full. */
export function mendHeal(exp: Expedition, registry: Registry): number {
  const shop = shopHere(exp);
  if (!shop) return 0;
  const max = expeditionMaxHp(exp, registry);
  return Math.min(Math.floor((max * shop.mend.percent) / 100), max - (exp.hp ?? max));
}

/** Why Mend can't be used here now, or undefined if it can. */
export function cannotMend(exp: Expedition, registry: Registry): string | undefined {
  const shop = shopHere(exp);
  if (!shop) return 'There is no Shop here.';
  if (shop.mend.used) return 'Already used here.';
  if (mendHeal(exp, registry) <= 0) return 'The party is at full HP.';
  if (exp.obols < shop.mend.price) return 'Not enough Obols.';
  return undefined;
}

export function mend(exp: Expedition, registry: Registry): Expedition {
  const reason = cannotMend(exp, registry);
  if (reason) throw new Error(reason);
  const next = structuredClone(exp);
  const shop = next.shops[next.board.at]!;
  next.hp = (exp.hp ?? expeditionMaxHp(exp, registry)) + mendHeal(exp, registry);
  next.obols -= shop.mend.price;
  shop.mend.used = true;
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

/** The M3 test (owner, 19 Oct): one board; an elite's relic pick and Shop stock from the M2 relics. Numbers are placeholders. */
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
  obols: { fight: 20, elite: 45 },
  shop: {
    prices: { common: 50, uncommon: 80, rare: 120, cursed: 30 },
    mend: { price: 40, percent: 25 },
  },
};
