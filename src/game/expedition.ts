import {
  createStreams,
  describeCard,
  formulaText,
  GAUGE_MAX,
  nextInt,
  shareOf,
  showStats,
  shuffleInPlace,
  type CombatSetup,
  type CombatState,
  type EventChoiceDef,
  type EventDef,
  type EventOutcome,
  type MotifDef,
  type Registry,
  type RelicDef,
  type RunCard,
  type Streams,
  type TextOptions,
  withDupes,
  withLevel,
} from '../engine/index.ts';
import { BLOOM_NODES, bloomNodeDue, bloomTick, reached, spawnBloomNode, stageOf, type BloomStage } from './bloom.ts';
import { resolveTile, stopsOn, walk, type Board } from './board.ts';
import { generateBoard, M3_LABYRINTH, type LabyrinthDef } from './labyrinth.ts';

// A run through the Labyrinth (docs/notes/m3-labyrinth.md, m4-run.md): the party walks the board,
// fights where it stops on a fight, and wins at the Boss. Party HP, ultimate gauges, relics and the
// run's own deck (card rewards and Symptoms) carry from fight to fight. Won fights, Events and Camp rests tick the Bloom
// clock (src/game/bloom.ts), which scales the enemies of later fights and, at Fruiting, sows Bloom
// nodes. Won fights give Obols, spent at Shops. Pure and seeded, like the engine.

export const EXPEDITION_STREAMS = ['fights', 'rewards', 'bloom', 'shops', 'events', 'cards'] as const;
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
  /** Card rewards a normal fight may offer, and how many it offers. */
  cards: { pool: string[]; offer: number };
  /** Obols for winning a fight, before the Bloom's bonus. */
  obols: { fight: number; elite: number };
  /**
   * What a run banks when it ends (`runBanking`): a win's pulls, and items (Memories and Ducats) for
   * the Boss, each normal fight won and each elite, all multiplied at Fruiting, with one of
   * `materials` from the Boss; otherwise pulls and the elite items per elite beaten, up to a cap.
   */
  banking: {
    win: number;
    fruiting: number;
    perElite: number;
    elitesMax: number;
    items: { fight: Record<string, number>; elite: Record<string, number>; boss: Record<string, number> };
    materials: string[];
  };
  shop: {
    /** A relic's price by its tier. */
    prices: Record<RelicTier, number>;
    /** Heal a share of max HP, once per Shop. */
    mend: { price: number; percent: number };
  };
  /** A Camp's Rest heals this share of max HP. */
  camp: { percent: number };
}

/** One Shop's stock: rolled on first entry, then kept all run with its prices and what is sold. */
export interface ShopStock {
  relics: { relic: string; price: number; sold?: true }[];
  mend: { price: number; percent: number; used?: true };
}

/** What an Event or Bloom node choice did, for the panel shown before the map returns. */
export interface Outcome {
  /** The Event chosen in; absent for a Bloom node. */
  event?: string;
  /** HP healed, or lost if negative. */
  hp?: number;
  /** Obols gained, or spent if negative. */
  obols?: number;
  relic?: string;
  /** A Symptom card that joined the deck. */
  card?: string;
  /** Ultimate charge each member gained. */
  charge?: number;
  /** Bloom clock ticks. */
  ticks?: number;
}

/** A Bloom node's choices (owner, 20 Oct). */
export type BloomChoice = 'fight' | 'gamble' | 'symptom';

/**
 * Dupe levels and levels by character, C0 and level 1 left out: a profile's, or a run's copy of them.
 * A profile and an expedition are each one.
 */
export interface Growth {
  dupes?: Readonly<Record<string, number>> | undefined;
  levels?: Readonly<Record<string, number>> | undefined;
}

/** Plain JSON, like combat state. */
export interface Expedition {
  party: string[];
  /**
   * The party's dupe levels and levels when the run began, by character (C0 and level 1 left out):
   * a copy pulled or a level gained mid-run counts from the next run.
   */
  dupes?: Record<string, number>;
  levels?: Record<string, number>;
  board: Board;
  /**
   * map: choosing where to walk. tile: stopped on a Shop, Camp, Event, Symptom or Bloom node.
   * fight: stopped on a fight. reward: the Victory panel after a won fight, with a normal fight's
   * card pick or an elite's relic pick. outcome: what an Event or Bloom node choice did. won and lost end the run.
   */
  phase: 'map' | 'tile' | 'fight' | 'reward' | 'outcome' | 'won' | 'lost';
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
  /** Cards on offer on the Victory panel, each with the member it would go to. */
  offeredCards: RunCard[];
  /** The cards the run has gained (card rewards and Symptoms), dealt into every fight. */
  deck: RunCard[];
  obols: number;
  /** Elite tiles beaten, for banking a lost or abandoned run. */
  elites: number;
  /** Other fights won (not elite tiles or the Boss), for banking a won run; absent is none. */
  fights?: number;
  /** The material the Boss gave, once she is beaten. */
  material?: string;
  /** What the last won fight gave, for the Victory panel: Obols, including the bonus (percent) of the Bloom stage it started at. */
  spoils?: { obols: number; bonus: number; stage: BloomStage };
  /** Each Shop's stock by tile key, once entered. */
  shops: Record<string, ShopStock>;
  /** From Fruiting on: tiles still to walk before the next Bloom node. */
  bloomDue?: number;
  /** What the last Event or Bloom node choice did, while its panel shows. */
  outcome?: Outcome;
  rng: Streams<ExpeditionStream>;
}

export function startExpedition(
  seed: number,
  party: string[],
  def: ExpeditionDef,
  motifs: Readonly<Record<string, MotifDef>>,
  growth: Growth = {},
): Expedition {
  const of = (table: Growth['dupes'], above: number) => Object.fromEntries(party.filter((id) => (table?.[id] ?? 0) > above).map((id) => [id, table![id]!]));
  const dupes = of(growth.dupes, 0);
  const levels = of(growth.levels, 1);
  return {
    party,
    ...(Object.keys(dupes).length > 0 && { dupes }),
    ...(Object.keys(levels).length > 0 && { levels }),
    board: generateBoard(seed, def.board, motifs),
    phase: 'map',
    hp: null,
    gauges: party.map(() => 0),
    clock: 0,
    relics: [],
    offered: [],
    offeredCards: [],
    deck: [],
    obols: 0,
    elites: 0,
    shops: {},
    rng: createStreams(seed, EXPEDITION_STREAMS),
  };
}

/**
 * Walks toward a tile. Returns the expedition after each step, so the walk can be shown tile by
 * tile; the last one has stopped and says what happens next. From Fruiting on, the steps count
 * toward the next Bloom node, which appears once the walk ends. Undefined if the party can't go there.
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
  if (reached(last.clock, 'fruiting')) sow(last, states.length, def);
  return states;
}

/**
 * The party can walk from the map, or away from a Shop or Camp. An Event or Bloom node must be
 * chosen first, and an unpaid Symptom paid or turned back from.
 */
export function canMove(exp: Expedition): boolean {
  if (exp.phase === 'map') return true;
  const tile = exp.board.tiles[exp.board.at];
  return exp.phase === 'tile' && (tile?.kind === 'shop' || tile?.kind === 'camp');
}

/** What stopping on the current tile means. A Shop entered for the first time rolls its stock, and an Event its Symptom card. */
function arrive(exp: Expedition, def: ExpeditionDef, registry: Registry): void {
  const tile = exp.board.tiles[exp.board.at]!;
  if (!stopsOn(tile)) exp.phase = 'map';
  else if (tile.kind === 'fight' || tile.kind === 'elite' || tile.kind === 'boss') startFight(exp);
  else exp.phase = 'tile';
  if (tile.kind === 'shop') exp.shops[exp.board.at] ??= rollShop(exp, def, registry);
  const offersCard = registry.events[tile.content ?? '']?.choices.some((c) => c.outcomes.some((o) => o.do === 'symptom'));
  if (tile.kind === 'event' && offersCard && tile.card === undefined && def.board.symptoms.length > 0) {
    tile.card = def.board.symptoms[nextInt(exp.rng, 'events', def.board.symptoms.length)]!;
  }
}

function startFight(exp: Expedition): void {
  exp.phase = 'fight';
  exp.fightSeed = nextInt(exp.rng, 'fights', 2 ** 31);
}

/** Counts a walk's steps toward the next Bloom node, and sows it once they are walked. With no room, it waits for the next walk. */
function sow(exp: Expedition, steps: number, def: ExpeditionDef): void {
  const due = (exp.bloomDue ?? bloomNodeDue(exp.rng, 'bloom')) - steps;
  if (due > 0) {
    exp.bloomDue = due;
    return;
  }
  const board = spawnBloomNode(exp.board, exp.rng, 'bloom', { fight: def.board.encounters.fight, symptoms: def.board.symptoms });
  if (board) exp.board = board;
  exp.bloomDue = board ? bloomNodeDue(exp.rng, 'bloom') : 0;
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

/**
 * The combat setup for the fight the party is standing on, scaled by the Bloom's stage. The Bloom
 * never scales the Boss; a Boss fight that starts at Fruiting is its Fruiting encounter, if it has
 * one (owner, 24 Oct).
 */
export function expeditionFight(exp: Expedition, registry: Registry): CombatSetup {
  const tile = exp.board.tiles[exp.board.at];
  const boss = tile?.kind === 'boss';
  const authored = registry.encounters[tile?.content ?? ''];
  const encounter = boss && authored?.fruiting && reached(exp.clock, 'fruiting') ? registry.encounters[authored.fruiting] : authored;
  if (exp.phase !== 'fight' || !encounter) throw new Error('There is no fight here.');
  const setup: CombatSetup = { seed: exp.fightSeed ?? 0, party: exp.party, enemies: encounter.enemies, relics: exp.relics, gauges: exp.gauges };
  if (exp.hp !== null) setup.partyHp = exp.hp;
  if (exp.deck.length > 0) setup.deck = exp.deck;
  if (exp.dupes) setup.dupes = exp.party.map((id) => exp.dupes?.[id] ?? 0);
  if (exp.levels) setup.levels = exp.party.map((id) => exp.levels?.[id] ?? 1);
  const scale = boss ? 0 : stageOf(exp.clock).enemyScale;
  if (scale > 0) setup.enemyScale = scale;
  return setup;
}

/**
 * Carries a finished fight back: a loss ends the run and the Boss wins it. Any other win gives
 * Obols (more at later Bloom stages), ticks the clock (except a Bloom node's fight) and opens the
 * Victory panel, where an elite offers relics and any other fight offers cards.
 */
export function finishExpeditionFight(exp: Expedition, combat: CombatState, def: ExpeditionDef, registry: Registry): Expedition {
  if (exp.phase !== 'fight' || combat.phase !== 'ended') throw new Error('The fight is not over.');
  const next = structuredClone(exp);
  delete next.fightSeed;
  next.hp = combat.party.hp;
  next.gauges = combat.members.map((m) => m.gauge);
  const kind = exp.board.tiles[exp.board.at]?.kind;
  if (combat.outcome === 'defeat') next.phase = 'lost';
  else if (kind === 'boss') {
    next.phase = 'won';
    const { materials } = def.banking;
    if (materials.length > 0) next.material = materials[nextInt(next.rng, 'rewards', materials.length)]!;
  } else {
    // The stage the fight started at, before its own tick.
    const { obolBonus: bonus, id: stage } = stageOf(exp.clock);
    const obols = Math.floor(((kind === 'elite' ? def.obols.elite : def.obols.fight) * (100 + bonus)) / 100);
    next.obols += obols;
    next.spoils = { obols, bonus, stage };
    next.board = resolveTile(next.board);
    next.phase = 'reward';
    if (kind !== 'bloom') tick(next, def);
    if (kind !== 'elite') next.fights = (next.fights ?? 0) + 1;
    if (kind === 'elite') {
      next.elites += 1;
      const pool = def.relicPool.filter((id) => !exp.relics.includes(id));
      shuffleInPlace(pool, next.rng, 'rewards');
      next.offered = pool.slice(0, def.offer);
    } else next.offeredCards = rollCards(next, def, registry);
  }
  return next;
}

/**
 * Who may own a card: its owner if she is in the party; for a Domain's generic card, the party's
 * members of that Domain, or every member for a Domain that slots into any team (owner, 24 Oct).
 */
export function eligibleOwners(card: string, party: readonly string[], registry: Registry): string[] {
  const def = registry.cards[card];
  if (def?.owner !== undefined) return party.includes(def.owner) ? [def.owner] : [];
  if (def?.domain === undefined) return [];
  if (registry.domains[def.domain]?.anyTeam) return [...party];
  return party.filter((id) => registry.characters[id]?.domain === def.domain);
}

/** A card offer: different cards from the pool that someone in the party may own, each given to a random eligible owner. */
function rollCards(exp: Expedition, def: ExpeditionDef, registry: Registry): RunCard[] {
  const pool = def.cards.pool.filter((card) => eligibleOwners(card, exp.party, registry).length > 0);
  shuffleInPlace(pool, exp.rng, 'cards');
  return pool.slice(0, def.cards.offer).map((card) => {
    const owners = eligibleOwners(card, exp.party, registry);
    return { card, owner: owners[nextInt(exp.rng, 'cards', owners.length)]! };
  });
}

/** Closes the Victory panel, taking one offered relic (or none), and returns to the map. */
export function chooseExpeditionRelic(exp: Expedition, relic: string | null): Expedition {
  if (exp.phase !== 'reward') throw new Error('Nothing is on offer.');
  if (relic !== null && !exp.offered.includes(relic)) throw new Error(`"${relic}" was not offered.`);
  const next = closeVictory(exp);
  if (relic !== null) next.relics.push(relic);
  return next;
}

/** Closes the Victory panel, taking the offered card at this index (or none) into the run's deck, and returns to the map. */
export function chooseExpeditionCard(exp: Expedition, index: number | null): Expedition {
  if (exp.phase !== 'reward') throw new Error('Nothing is on offer.');
  const card = index === null ? undefined : exp.offeredCards[index];
  if (index !== null && !card) throw new Error(`No card is offered at ${index}.`);
  const next = closeVictory(exp);
  if (card) next.deck.push(card);
  return next;
}

function closeVictory(exp: Expedition): Expedition {
  const next = structuredClone(exp);
  next.offered = [];
  next.offeredCards = [];
  delete next.spoils;
  next.phase = 'map';
  return next;
}

/** A character as she fights: at her dupe level and level, if given (an expedition's or a profile's). */
export function fieldedCharacter(id: string, registry: Registry, growth: Growth = {}) {
  const def = registry.characters[id];
  return def && withLevel(withDupes(def, growth.dupes?.[id]), growth.levels?.[id]);
}

/** A run card's text with its owner's stats (at her dupe level and level) as numbers; what depends on the fight shows as written. */
export function runCardText(card: RunCard, registry: Registry, options: TextOptions = {}, growth: Growth = {}): string {
  const def = registry.cards[card.card];
  const stats = fieldedCharacter(card.owner ?? '', registry, growth)?.stats;
  if (!def) return card.card;
  return describeCard(def, registry, stats ? showStats(stats, options.mark) : formulaText, options);
}

/** The party's max HP: its members' HP added up, as combat starts it. */
export function expeditionMaxHp(exp: Expedition, registry: Registry): number {
  return exp.party.reduce((sum, id) => sum + (fieldedCharacter(id, registry, exp)?.stats.hp ?? 0), 0);
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

/** Steps back onto the map from a Shop or Camp, which stays for later. */
export function leaveTile(exp: Expedition): Expedition {
  if (!canMove(exp) || exp.phase !== 'tile') throw new Error('There is nothing here to leave.');
  return { ...structuredClone(exp), phase: 'map' };
}

/** The HP a Camp's Rest would heal now: its share of max HP, up to full. */
export function restHeal(exp: Expedition, def: ExpeditionDef, registry: Registry): number {
  const max = expeditionMaxHp(exp, registry);
  return Math.min(Math.floor((max * def.camp.percent) / 100), max - (exp.hp ?? max));
}

/** Why the party can't Rest here now, or undefined if it can. */
export function cannotRest(exp: Expedition, def: ExpeditionDef, registry: Registry): string | undefined {
  if (exp.phase !== 'tile' || exp.board.tiles[exp.board.at]?.kind !== 'camp') return 'There is no Camp here.';
  if (restHeal(exp, def, registry) <= 0) return 'The party is at full HP.';
  return undefined;
}

/** Rests at the Camp: heals, ticks the clock and uses the Camp up. */
export function rest(exp: Expedition, def: ExpeditionDef, registry: Registry): Expedition {
  const reason = cannotRest(exp, def, registry);
  if (reason) throw new Error(reason);
  const next = structuredClone(exp);
  next.hp = (exp.hp ?? expeditionMaxHp(exp, registry)) + restHeal(exp, def, registry);
  next.board = resolveTile(next.board);
  next.phase = 'map';
  tick(next, def);
  return next;
}

/** Takes the Symptom tile's card into the run's deck, which pays the toll: the tile is free to pass from then on. */
export function takeSymptom(exp: Expedition): Expedition {
  const tile = exp.board.tiles[exp.board.at];
  if (exp.phase !== 'tile' || tile?.kind !== 'symptom' || tile.paid || tile.card === undefined) throw new Error('There is no Symptom to take here.');
  const next = structuredClone(exp);
  next.deck.push({ card: tile.card });
  next.board = resolveTile(next.board);
  next.phase = 'map';
  return next;
}

/** A Symptom card's text with its numbers for the party as it stands (HP costs are a share of HP). */
export function symptomText(exp: Expedition, card: string, registry: Registry): string {
  const def = registry.cards[card];
  if (!def) return card;
  const party = { hp: exp.hp ?? expeditionMaxHp(exp, registry), maxHp: expeditionMaxHp(exp, registry) };
  return describeCard(def, registry, (f) => (typeof f === 'object' && 'percent' in f ? String(Math.floor(shareOf(f, party))) : formulaText(f)));
}

/** The Event the party is standing on, while it waits for a choice. */
export function eventHere(exp: Expedition, registry: Registry): EventDef | undefined {
  const tile = exp.board.tiles[exp.board.at];
  return exp.phase === 'tile' && tile?.kind === 'event' ? registry.events[tile.content ?? ''] : undefined;
}

/** Relics of a tier an Event could give: in the pool and not owned. */
const relicsOf = (exp: Expedition, tier: RelicTier, def: ExpeditionDef, registry: Registry) =>
  def.relicPool.filter((id) => registry.relics[id]?.tier === tier && !exp.relics.includes(id));

/** One line per outcome of an Event choice, with its numbers for the party as it stands. */
export function describeChoice(exp: Expedition, choice: EventChoiceDef, registry: Registry): string[] {
  if (choice.outcomes.length === 0) return ['Nothing happens.'];
  const max = expeditionMaxHp(exp, registry);
  const hp = exp.hp ?? max;
  const card = exp.board.tiles[exp.board.at]?.card;
  return choice.outcomes.map((o) => {
    switch (o.do) {
      case 'obols':
        return `Gain ${o.amount} Obols.`;
      case 'pay':
        return `Pay ${o.amount} Obols.`;
      case 'relic':
        return `Gain a random ${titleCase(o.tier)} relic.`;
      case 'loseHp':
        return `The party loses ${Math.floor((hp * o.percent) / 100)} HP (${o.percent}% of current).`;
      case 'heal':
        return `Heal ${Math.min(Math.floor((max * o.percent) / 100), max - hp)} HP (${o.percent}% of max).`;
      case 'charge':
        return `Every party member gains ${o.amount} ultimate charge.`;
      case 'symptom':
        return `Take the Symptom ${registry.cards[card ?? '']?.name ?? card}.`;
      case 'tick':
        return `The Bloom clock ticks ${o.count === 1 ? 'once' : `${o.count} times`} more.`;
    }
  });
}

/** Why an Event choice can't be taken now, or undefined if it can. */
export function cannotChoose(exp: Expedition, index: number, def: ExpeditionDef, registry: Registry): string | undefined {
  const choice = eventHere(exp, registry)?.choices[index];
  if (!choice) return 'There is no such choice here.';
  for (const o of choice.outcomes) {
    if (o.do === 'pay' && exp.obols < o.amount) return 'Not enough Obols.';
    if (o.do === 'relic' && relicsOf(exp, o.tier, def, registry).length === 0) return `No ${titleCase(o.tier)} relic is left.`;
    if (o.do === 'symptom' && exp.board.tiles[exp.board.at]?.card === undefined) return 'No Symptom is left.';
  }
  return undefined;
}

/** Takes an Event choice: its outcomes in order, then the Event's own tick. The Event is used up. */
export function chooseEvent(exp: Expedition, index: number, def: ExpeditionDef, registry: Registry): Expedition {
  const reason = cannotChoose(exp, index, def, registry);
  if (reason) throw new Error(reason);
  const choice = eventHere(exp, registry)!.choices[index]!;
  const next = structuredClone(exp);
  const outcome: Outcome = { event: eventHere(exp, registry)!.id, ticks: 1 };
  for (const o of choice.outcomes) applyOutcome(next, o, outcome, def, registry);
  next.board = resolveTile(next.board);
  for (let i = 0; i < outcome.ticks!; i++) tick(next, def);
  next.outcome = outcome;
  next.phase = 'outcome';
  return next;
}

function applyOutcome(exp: Expedition, o: EventOutcome, out: Outcome, def: ExpeditionDef, registry: Registry): void {
  const max = expeditionMaxHp(exp, registry);
  const hp = exp.hp ?? max;
  const add = (key: 'hp' | 'obols' | 'charge' | 'ticks', n: number) => (out[key] = (out[key] ?? 0) + n);
  switch (o.do) {
    case 'obols':
      exp.obols += o.amount;
      add('obols', o.amount);
      break;
    case 'pay':
      exp.obols -= o.amount;
      add('obols', -o.amount);
      break;
    case 'relic': {
      const pool = relicsOf(exp, o.tier, def, registry);
      out.relic = pool[nextInt(exp.rng, 'events', pool.length)]!;
      exp.relics.push(out.relic);
      break;
    }
    case 'loseHp': {
      const lost = Math.floor((hp * o.percent) / 100);
      exp.hp = hp - lost;
      add('hp', -lost);
      break;
    }
    case 'heal': {
      const healed = Math.min(Math.floor((max * o.percent) / 100), max - hp);
      exp.hp = hp + healed;
      add('hp', healed);
      break;
    }
    case 'charge':
      exp.gauges = exp.gauges.map((g) => Math.min(GAUGE_MAX, g + o.amount));
      add('charge', o.amount);
      break;
    case 'symptom':
      out.card = exp.board.tiles[exp.board.at]!.card!;
      exp.deck.push({ card: out.card });
      break;
    case 'tick':
      add('ticks', o.count);
      break;
  }
}

/** The HP a Bloom node's gamble puts at stake: a share of current HP, rounded down. */
export function gambleStake(exp: Expedition, registry: Registry): number {
  return Math.floor(((exp.hp ?? expeditionMaxHp(exp, registry)) * BLOOM_NODES.gamble) / 100);
}

/** Whether the party stands on a Bloom node that waits for its choice. */
export const onBloomNode = (exp: Expedition): boolean => exp.phase === 'tile' && exp.board.tiles[exp.board.at]?.kind === 'bloom';

/**
 * Takes a Bloom node's choice, which uses the node up and doesn't tick the clock: its fight, a
 * 50/50 gamble to heal (up to full) or lose a share of current HP, or its Symptom card.
 */
export function chooseBloom(exp: Expedition, choice: BloomChoice, registry: Registry): Expedition {
  if (!onBloomNode(exp)) throw new Error('There is no Bloom node here.');
  const next = structuredClone(exp);
  if (choice === 'fight') {
    startFight(next);
    return next;
  }
  const max = expeditionMaxHp(exp, registry);
  const hp = exp.hp ?? max;
  if (choice === 'gamble') {
    const stake = gambleStake(exp, registry);
    const change = nextInt(next.rng, 'bloom', 2) === 0 ? -stake : Math.min(stake, max - hp);
    next.hp = hp + change;
    next.outcome = { hp: change };
  } else {
    const card = exp.board.tiles[exp.board.at]!.card!;
    next.deck.push({ card });
    next.outcome = { card };
  }
  next.board = resolveTile(next.board);
  next.phase = 'outcome';
  return next;
}

/** Closes the panel showing what a choice did, and returns to the map. */
export function closeOutcome(exp: Expedition): Expedition {
  if (exp.phase !== 'outcome') throw new Error('There is no outcome to close.');
  const next = structuredClone(exp);
  delete next.outcome;
  next.phase = 'map';
  return next;
}

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

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
  // M4.1: every card reward, offered three at a time (docs/notes/m4-run.md).
  cards: {
    pool: [
      'maelia.nursing-bud',
      'maelia.pollen-drift',
      'agathe.hymnal-procession',
      'agathe.thurible-swing',
      'anthe.ash-offering',
      'anthe.long-vigil',
      'leonora.ledger-balance',
      'leonora.writ-of-seizure',
      'flesh.grafting-knife',
      'rapture.chalk-circle',
      'spirit.quiet-prayer',
      'unbound.pocket-watch',
    ],
    offer: 3,
  },
  obols: { fight: 20, elite: 45 },
  // Pulls: M4.3 (owner, 24 Oct). Memories, Ducats and the Boss's material: M5.5 (owner, 29 Oct, placeholders).
  banking: {
    win: 5,
    fruiting: 2,
    perElite: 1,
    elitesMax: 3,
    items: {
      fight: { 'memory.faint': 1, money: 50 },
      elite: { 'memory.clear': 1, money: 150 },
      boss: { 'memory.vivid': 1, money: 500 },
    },
    materials: ['material.flesh', 'material.rapture', 'material.spirit', 'material.unbound'],
  },
  shop: {
    prices: { common: 50, uncommon: 80, rare: 120, cursed: 30 },
    mend: { price: 40, percent: 25 },
  },
  camp: { percent: 30 },
};
