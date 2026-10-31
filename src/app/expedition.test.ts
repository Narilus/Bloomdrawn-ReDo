import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { apply, startCombat, validate, type CombatState, type Command } from '../engine/index.ts';
import { createBoard, routeTo, stopsOn, visibleKind, type Tile } from '../game/board.ts';
import {
  buyRelic,
  canMove,
  cannotBuy,
  cannotMend,
  cannotChoose,
  cannotRest,
  chooseBloom,
  chooseEvent,
  chooseExpeditionCard,
  chooseExpeditionRelic,
  eligibleOwners,
  EXPEDITION_STREAMS,
  runCardText,
  closeOutcome,
  describeChoice,
  eventHere,
  onBloomNode,
  shopHere,
  rest,
  symptomText,
  takeSymptom,
  expeditionFight,
  expeditionMaxHp,
  finishExpeditionFight,
  leaveTile,
  M3_EXPEDITION,
  mend,
  mendHeal,
  move,
  startExpedition,
  turnBack,
  type Expedition,
} from '../game/expedition.ts';
import { bloomNodeDue } from '../game/bloom.ts';
import { bank, NEW_PROFILE, runBanking } from '../game/profile.ts';
import { itemCount } from '../content/items.ts';
import { CONTENT_VERSION } from '../content/version.ts';
import { decodeSave, encodeSave } from '../save/store.ts';
import { RUN_SAVE } from './saves.ts';
import { hexKey } from '../game/hex.ts';
import { createStreams } from '../engine/index.ts';

// The Labyrinth run rules (src/game/expedition.ts) with the real content. Here because the game
// layer may not import content.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
const row = (...tiles: Tile[]) => Object.fromEntries(tiles.map((t, q) => [hexKey({ q, r: 0 }), t]));
/** A fresh expedition on a hand-made row of tiles. */
const on = (...tiles: Tile[]): Expedition => ({ ...startExpedition(1, PARTY, M3_EXPEDITION, registry.motifs), board: createBoard(row(...tiles), '0,0') });
const go = (exp: Expedition, to: string) => {
  const states = move(exp, to, M3_EXPEDITION, registry);
  if (!states) throw new Error(`No way to ${to}`);
  return states;
};
/** The fight the party stands on, ended as given. */
function ended(exp: Expedition, outcome: 'victory' | 'defeat', hp: number): CombatState {
  const state = startCombat(expeditionFight(exp, registry), registry).state;
  return { ...state, phase: 'ended', outcome, party: { ...state.party, hp }, members: state.members.map((m) => ({ ...m, gauge: 40 })) };
}
const HOUND = { kind: 'fight', content: 'encounter.hound' } as const;
const SYMPTOM = { kind: 'symptom', card: 'symptom.grafted-hand' } as const;
const SURVEY = { kind: 'event', content: 'event.survey-pack' } as const;
const CAMP = { kind: 'camp' } as const;

describe('the expedition', () => {
  it('starts on a generated board at the entrance, at full HP with empty gauges', () => {
    const exp = startExpedition(3, PARTY, M3_EXPEDITION, registry.motifs);
    expect(exp.board.tiles[exp.board.at]!.kind).toBe('entrance');
    expect([exp.phase, exp.hp, exp.gauges]).toEqual(['map', null, [0, 0, 0, 0]]);
  });

  it('walks tile by tile and stops on a fight, which then uses that tile’s encounter', () => {
    const states = go(on({ kind: 'entrance' }, { kind: 'path' }, HOUND), '2,0');
    expect(states.map((s) => [s.board.at, s.phase])).toEqual([
      ['1,0', 'map'],
      ['2,0', 'fight'],
    ]);
    expect(expeditionFight(states[1]!, registry).enemies).toEqual(['enemy.bloom-rib-hound']);
  });

  it('a won fight clears the tile and carries HP and gauges into the next fight', () => {
    const fighting = go(on({ kind: 'entrance' }, HOUND, HOUND), '1,0').at(-1)!;
    const after = chooseExpeditionRelic(finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION, registry), null);
    expect([after.phase, after.hp, after.gauges, after.board.tiles['1,0']]).toEqual(['map', 150, [40, 40, 40, 40], { kind: 'path' }]);
    const next = expeditionFight(go(after, '2,0').at(-1)!, registry);
    expect([next.partyHp, next.gauges]).toEqual([150, [40, 40, 40, 40]]);
  });

  it('an elite offers three relics; the Boss ends the run in victory; a loss ends it in defeat', () => {
    const elite = go(on({ kind: 'entrance' }, { kind: 'elite', content: 'encounter.thorn-wall' }), '1,0').at(-1)!;
    const reward = finishExpeditionFight(elite, ended(elite, 'victory', 120), M3_EXPEDITION, registry);
    expect(reward.phase).toBe('reward');
    expect(reward.offered).toHaveLength(3);
    const picked = chooseExpeditionRelic(reward, reward.offered[0]!);
    expect([picked.phase, picked.relics]).toEqual(['map', [reward.offered[0]]]);

    const boss = go(on({ kind: 'entrance' }, { kind: 'boss', content: 'encounter.hound-mother' }), '1,0').at(-1)!;
    expect(finishExpeditionFight(boss, ended(boss, 'victory', 60), M3_EXPEDITION, registry).phase).toBe('won');
    expect(finishExpeditionFight(boss, ended(boss, 'defeat', 0), M3_EXPEDITION, registry).phase).toBe('lost');
  });

  it('on an unpaid Symptom the party must take its card or turn back; it cannot walk on past', () => {
    const toll = go(on({ kind: 'entrance' }, SYMPTOM, { kind: 'path' }), '1,0').at(-1)!;
    expect([toll.phase, canMove(toll), move(toll, '2,0', M3_EXPEDITION, registry)]).toEqual(['tile', false, undefined]);
    expect(turnBack(toll)!.board.at).toBe('0,0');
    const paid = takeSymptom(toll);
    expect([paid.phase, paid.board.tiles['1,0']!.paid, paid.deck]).toEqual(['map', true, [{ card: 'symptom.grafted-hand' }]]);
    expect(go(paid, '2,0').at(-1)!.board.at).toBe('2,0');
  });

  it('a Shop is looked at and left, and stays; an Event must be chosen, and is used up', () => {
    const shop = go(on({ kind: 'entrance' }, { kind: 'shop' }, SURVEY, { kind: 'path' }), '1,0').at(-1)!;
    expect([shop.phase, canMove(shop)]).toEqual(['tile', true]);
    const event = go(shop, '2,0').at(-1)!;
    expect(event.board.tiles['1,0']!.kind).toBe('shop');
    expect([canMove(event), move(event, '3,0', M3_EXPEDITION, registry)]).toEqual([false, undefined]);
    expect(() => leaveTile(event)).toThrow();
    expect(chooseEvent(event, 0, M3_EXPEDITION, registry).board.tiles['2,0']).toEqual({ kind: 'path' });
  });
});

describe('the Bloom clock on a run', () => {
  it('ticks on a won fight, an Event and a Camp rest; walking, Shops and Symptoms leave it', () => {
    const fighting = go(on({ kind: 'entrance' }, HOUND, { kind: 'shop' }, SURVEY, CAMP), '1,0').at(-1)!;
    const won = chooseExpeditionRelic(finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION, registry), null);
    expect(won.clock).toBe(1);
    const shop = leaveTile(go(won, '2,0').at(-1)!);
    expect(shop.clock).toBe(1);
    const chosen = closeOutcome(chooseEvent(go(shop, '3,0').at(-1)!, 0, M3_EXPEDITION, registry));
    expect(chosen.clock).toBe(2);
    expect(rest(go(chosen, '4,0').at(-1)!, M3_EXPEDITION, registry).clock).toBe(3);
    const toll = go(on({ kind: 'entrance' }, SYMPTOM), '1,0').at(-1)!;
    expect(takeSymptom(toll).clock).toBe(0);
  });

  it('a fight started at a later stage brings scaled enemies', () => {
    const fighting = go(on({ kind: 'entrance' }, HOUND), '1,0').at(-1)!;
    expect(expeditionFight(fighting, registry).enemyScale).toBeUndefined();
    const seeded = expeditionFight({ ...fighting, clock: 3 }, registry);
    expect(seeded.enemyScale).toBe(10);
    const hound = registry.enemies['enemy.bloom-rib-hound']!.hp;
    expect(startCombat(seeded, registry).state.enemies[0]!.maxHp).toBe(Math.floor(hound * 1.1));
  });

});

describe('Obols and the Victory panel', () => {
  const ELITE = { kind: 'elite', content: 'encounter.thorn-wall' } as const;
  const win = (exp: Expedition) => finishExpeditionFight(exp, ended(exp, 'victory', 150), M3_EXPEDITION, registry);

  it('a won fight gives 20 Obols and an elite 45, shown on the Victory panel until it is closed', () => {
    const fight = win(go(on({ kind: 'entrance' }, HOUND), '1,0').at(-1)!);
    expect([fight.phase, fight.obols, fight.spoils, fight.offered]).toEqual(['reward', 20, { obols: 20, bonus: 0, stage: 'dormant' }, []]);
    const back = chooseExpeditionRelic(fight, null);
    expect([back.phase, back.obols, back.spoils]).toEqual(['map', 20, undefined]);
    const elite = win(go(on({ kind: 'entrance' }, ELITE), '1,0').at(-1)!);
    expect([elite.obols, elite.offered.length]).toEqual([45, 3]);
  });

  it('the Bloom stage a fight starts at adds its bonus, rounded down; the Boss gives none', () => {
    const at = (clock: number) => win({ ...go(on({ kind: 'entrance' }, HOUND), '1,0').at(-1)!, clock });
    expect([3, 6, 9, 12].map((clock) => at(clock).spoils)).toEqual([
      { obols: 22, bonus: 10, stage: 'seeded' },
      { obols: 24, bonus: 20, stage: 'rooted' },
      { obols: 27, bonus: 35, stage: 'flowering' },
      { obols: 30, bonus: 50, stage: 'fruiting' },
    ]);
    const boss = go(on({ kind: 'entrance' }, { kind: 'boss', content: 'encounter.hound-mother' }), '1,0').at(-1)!;
    expect(win(boss).obols).toBe(0);
  });
});

describe('Shops', () => {
  const SHOP = { kind: 'shop' } as const;
  const enter = (exp: Expedition) => go(exp, '1,0').at(-1)!;
  const tierOf = (id: string) => registry.relics[id]!.tier;

  it('first entry rolls one relic of each tier at its price, and Mend', () => {
    const shop = enter(on({ kind: 'entrance' }, SHOP)).shops['1,0']!;
    expect(shop.relics.map((r) => [tierOf(r.relic), r.price])).toEqual([
      ['common', 50],
      ['uncommon', 80],
      ['rare', 120],
      ['cursed', 30],
    ]);
    expect(shop.mend).toEqual({ price: 40, percent: 25 });
  });

  it('keeps its stock across visits, so leaving and coming back never rerolls it', () => {
    const first = enter(on({ kind: 'entrance' }, SHOP, { kind: 'path' }));
    const away = go(first, '2,0').at(-1)!;
    const again = go(away, '1,0').at(-1)!;
    expect(again.shops['1,0']).toEqual(first.shops['1,0']);
  });

  it('is seeded, and never stocks a relic already owned or on sale in another Shop', () => {
    const owner = { ...on({ kind: 'entrance' }, SHOP), relics: ['relic.brass-thimble'] };
    expect(enter(owner).shops['1,0']).toEqual(enter(structuredClone(owner)).shops['1,0']);
    expect(enter(owner).shops['1,0']!.relics.map((r) => r.relic)).toContain('relic.seed-packet');
    const second = { ...on({ kind: 'entrance' }, SHOP), relics: owner.relics, shops: enter(owner).shops };
    second.shops = { '9,9': second.shops['1,0']! };
    const stocked = enter(second).shops['1,0']!;
    // The only cursed relic and the last common are on sale elsewhere: those tiers stay empty here.
    expect(stocked.relics.map((r) => tierOf(r.relic))).toEqual(['uncommon', 'rare']);
  });

  it('buying spends Obols, adds the relic for the rest of the run, and sells it out', () => {
    const shop = { ...enter(on({ kind: 'entrance' }, SHOP)), obols: 100 };
    const [common, uncommon, rare] = shop.shops['1,0']!.relics.map((r) => r.relic);
    const bought = buyRelic(shop, common!);
    expect([bought.obols, bought.relics, bought.shops['1,0']!.relics[0]!.sold]).toEqual([50, [common], true]);
    expect([cannotBuy(bought, common!), cannotBuy(bought, rare!), cannotBuy(bought, uncommon!)]).toEqual(['Sold.', 'Not enough Obols.', 'Not enough Obols.']);
    expect(() => buyRelic(bought, rare!)).toThrow('Not enough Obols.');
    expect(cannotBuy(go(bought, '0,0').at(-1)!, uncommon!)).toBe('Not for sale here.');
  });

  it('Mend heals 25% of max HP, up to full, once per Shop', () => {
    const max = PARTY.reduce((sum, id) => sum + registry.characters[id]!.stats.hp, 0);
    const hurt = { ...enter(on({ kind: 'entrance' }, SHOP)), obols: 100, hp: 60 };
    expect(cannotMend({ ...hurt, hp: null }, registry)).toBe('The party is at full HP.');
    expect(mendHeal(hurt, registry)).toBe(Math.floor(max / 4));
    const mended = mend(hurt, registry);
    expect([mended.hp, mended.obols, cannotMend(mended, registry)]).toEqual([60 + Math.floor(max / 4), 60, 'Already used here.']);
    expect(mend({ ...hurt, hp: max - 5 }, registry).hp).toBe(max);
    expect(cannotMend({ ...hurt, obols: 39 }, registry)).toBe('Not enough Obols.');
  });
});

const MAX_HP = PARTY.reduce((sum, id) => sum + registry.characters[id]!.stats.hp, 0);
const enter = (exp: Expedition) => go(exp, '1,0').at(-1)!;

describe('Camps', () => {
  it(`Rest heals 30% of max HP (${Math.floor(MAX_HP * 0.3)}), up to full, ticks the clock and uses the Camp up`, () => {
    const camp = { ...enter(on({ kind: 'entrance' }, CAMP)), hp: 100 };
    const rested = rest(camp, M3_EXPEDITION, registry);
    expect([rested.hp, rested.clock, rested.phase, rested.board.tiles['1,0']]).toEqual([100 + Math.floor(MAX_HP * 0.3), 1, 'map', { kind: 'path' }]);
    expect(rest({ ...camp, hp: MAX_HP - 10 }, M3_EXPEDITION, registry).hp).toBe(MAX_HP);
  });

  it('can be left and kept for later, and is no use at full HP', () => {
    const camp = enter(on({ kind: 'entrance' }, CAMP, { kind: 'path' }));
    expect(cannotRest(camp, M3_EXPEDITION, registry)).toBe('The party is at full HP.');
    const later = go(go(leaveTile(camp), '2,0').at(-1)!, '1,0').at(-1)!;
    expect([later.phase, later.board.tiles['1,0']]).toEqual(['tile', CAMP]);
  });
});

describe('card rewards', () => {
  const ELITE = { kind: 'elite', content: 'encounter.thorn-wall' } as const;
  const POOL = M3_EXPEDITION.cards.pool;
  /** A won normal fight for this party, on a run seeded as given. */
  const won = (seed: number, party = PARTY, tiles: Tile[] = [{ kind: 'entrance' }, HOUND]) => {
    const exp = { ...startExpedition(seed, party, M3_EXPEDITION, registry.motifs), board: createBoard(row(...tiles), '0,0') };
    const fight = go(exp, '1,0').at(-1)!;
    return finishExpeditionFight(fight, ended(fight, 'victory', 100), M3_EXPEDITION, registry);
  };

  it('a normal fight offers three different cards, each going to a member who may own it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const offer = won(seed).offeredCards;
      expect(offer).toHaveLength(3);
      expect(new Set(offer.map((c) => c.card)).size).toBe(3);
      for (const { card, owner } of offer) {
        expect(POOL).toContain(card);
        expect(eligibleOwners(card, PARTY, registry)).toContain(owner);
      }
    }
  });

  it('a run fields the party chosen, front first: its fights and its card offers follow it (party select, M5.1)', () => {
    const party = ['leonora', 'anthe', 'maelia', 'agathe'];
    const exp = { ...startExpedition(3, party, M3_EXPEDITION, registry.motifs), board: createBoard(row({ kind: 'entrance' }, HOUND), '0,0') };
    const combat = startCombat(expeditionFight(go(exp, '1,0').at(-1)!, registry), registry).state;
    expect(combat.members.map((m) => m.character)).toEqual(party);
    for (let seed = 1; seed <= 20; seed++) {
      for (const { card, owner } of won(seed, party).offeredCards) expect(eligibleOwners(card, party, registry)).toContain(owner);
    }
  });

  it("a run fields its party at the dupe levels it began with: fights, max HP and card numbers (M5.4)", () => {
    const party = ['virelle', 'isadora', 'kibane', 'hester'];
    // Leonora isn't fielded and Isadora is at C0, so neither is kept.
    const exp = { ...startExpedition(3, party, M3_EXPEDITION, registry.motifs, { dupes: { virelle: 2, kibane: 5, isadora: 0, leonora: 3 } }), board: createBoard(row({ kind: 'entrance' }, HOUND), '0,0') };
    expect(exp.dupes).toEqual({ virelle: 2, kibane: 5 });
    const combat = startCombat(expeditionFight(go(exp, '1,0').at(-1)!, registry), registry).state;
    expect(combat.members.map((m) => m.dupes)).toEqual([2, undefined, 5, undefined]);
    // C2 adds 5 to Virelle's 45 and to Kibane's 50.
    expect([expeditionMaxHp(exp, registry), combat.party.maxHp]).toEqual([210, 210]);
    // Thorn Spur deals 3 + Attack: 6 at C0, 7 at C2.
    const spur = { card: 'virelle.thorn-spur', owner: 'virelle' };
    expect([runCardText(spur, registry), runCardText(spur, registry, {}, exp)]).toEqual(['Deal 9 damage twice.', 'Deal 10 damage twice.']);
    // A run at C0 has no levels to keep, so its save is as before.
    expect(startExpedition(3, party, M3_EXPEDITION, registry.motifs)).not.toHaveProperty('dupes');
  });

  it('a run fields its party at the levels and ascensions it began with, on top of their dupe levels (M5.5, M6)', () => {
    const party = ['virelle', 'isadora', 'kibane', 'hester'];
    // Leonora isn't fielded and Hester is level 1 with none, so neither is kept.
    const growth = { dupes: { virelle: 2 }, levels: { virelle: 21, hester: 1, leonora: 9 }, ascensions: { virelle: 2, hester: 0, leonora: 1 } };
    const exp = { ...startExpedition(3, party, M3_EXPEDITION, registry.motifs, growth), board: createBoard(row({ kind: 'entrance' }, HOUND), '0,0') };
    expect([exp.dupes, exp.levels, exp.ascensions]).toEqual([{ virelle: 2 }, { virelle: 21 }, { virelle: 2 }]);
    const combat = startCombat(expeditionFight(go(exp, '1,0').at(-1)!, registry), registry).state;
    expect(combat.members.map((m) => [m.dupes, m.level, m.ascensions])).toEqual([[2, 21, 2], [undefined, undefined, undefined], [undefined, undefined, undefined], [undefined, undefined, undefined]]);
    // An Attacker at level 21 with two ascensions grows by 0.559 of her role's multipliers: C2's 50 HP becomes 190, its Attack 7 becomes 38.
    expect([expeditionMaxHp(exp, registry), combat.party.maxHp]).toEqual([190 + 50 + 50 + 55, 190 + 50 + 50 + 55]);
    expect(runCardText({ card: 'virelle.thorn-spur', owner: 'virelle' }, registry, {}, exp)).toBe('Deal 41 damage twice.');
    expect(startExpedition(3, party, M3_EXPEDITION, registry.motifs)).not.toHaveProperty('levels');
    expect(startExpedition(3, party, M3_EXPEDITION, registry.motifs)).not.toHaveProperty('ascensions');
  });

  it('elites give relics only, the Boss ends the run, and a Bloom node fight offers cards like any fight', () => {
    expect(won(1, PARTY, [{ kind: 'entrance' }, ELITE]).offeredCards).toEqual([]);
    const boss = won(1, PARTY, [{ kind: 'entrance' }, { kind: 'boss', content: 'encounter.hound' }]);
    expect([boss.phase, boss.offeredCards]).toEqual(['won', []]);
    const node = enter({ ...on({ kind: 'entrance' }, { kind: 'bloom', content: 'encounter.hound', card: 'symptom.pollen-lung' }), clock: 12 });
    const fight = chooseBloom(node, 'fight', registry);
    expect(finishExpeditionFight(fight, ended(fight, 'victory', 150), M3_EXPEDITION, registry).offeredCards).toHaveLength(3);
  });

  it("the pool follows the party's Domains: Unbound's card always, any other only with a member of its Domain", () => {
    const party = ['maelia', 'agathe'];
    const seen = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 80; seed++) {
      for (const { card, owner } of won(seed, party).offeredCards) seen.set(card, (seen.get(card) ?? new Set()).add(owner!));
    }
    expect([...seen.keys()].sort()).toEqual([
      'agathe.hymnal-procession', 'agathe.thurible-swing', 'flesh.grafting-knife', 'maelia.nursing-bud', 'maelia.pollen-drift',
      'rapture.chalk-circle', 'unbound.pocket-watch',
    ]);
    expect(seen.get('flesh.grafting-knife')).toEqual(new Set(['maelia']));
    expect(seen.get('rapture.chalk-circle')).toEqual(new Set(['agathe']));
    // Unbound slots into any team, so its card may go to either.
    expect(seen.get('unbound.pocket-watch')).toEqual(new Set(['maelia', 'agathe']));
    expect(eligibleOwners('spirit.quiet-prayer', party, registry)).toEqual([]);
    expect(eligibleOwners('symptom.pollen-lung', party, registry)).toEqual([]);
  });

  it('a taken card joins the deck and is dealt into the next fight, played by its owner; skipping takes nothing', () => {
    const reward = won(3, PARTY, [{ kind: 'entrance' }, HOUND, HOUND]);
    const card = reward.offeredCards[1]!;
    const took = chooseExpeditionCard(reward, 1);
    expect([took.phase, took.deck, took.offeredCards, took.spoils]).toEqual(['map', [card], [], undefined]);
    const setup = expeditionFight(go(took, '2,0').at(-1)!, registry);
    const piles = startCombat(setup, registry).state.piles;
    expect([...piles.draw, ...piles.hand].filter((c) => c.card === card.card).map((c) => c.owner)).toEqual([`m${PARTY.indexOf(card.owner!)}`]);
    expect(chooseExpeditionCard(reward, null).deck).toEqual([]);
    expect(() => chooseExpeditionCard(reward, 3)).toThrow();
  });

  it("the offer replays exactly from the run's seed", () => {
    expect(won(5).offeredCards).toEqual(won(5).offeredCards);
    const offers = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(won(seed + 1).offeredCards)));
    expect(offers.size).toBeGreaterThan(5);
  });

  it("an offered card shows its numbers with its owner's stats, and what depends on the fight as written", () => {
    expect(runCardText({ card: 'flesh.grafting-knife', owner: 'maelia' }, registry)).toBe('Deal 7 damage. Apply 9 Bleed.');
    expect(runCardText({ card: 'unbound.pocket-watch', owner: 'agathe' }, registry)).toBe('Draw 2 cards.');
    expect(runCardText({ card: 'rapture.chalk-circle', owner: 'agathe' }, registry)).toBe('Gain 1 Tentacle. Gain 8 Shield.');
    expect(runCardText({ card: 'anthe.long-vigil', owner: 'anthe' }, registry)).toBe('Ritual. Deal 10 + 6 × Essence damage to all enemies.');
    // No Strike has been played outside a fight, so Virelle's Strike shows its base damage.
    expect(runCardText({ card: 'virelle.strike', owner: 'virelle' }, registry, { charge: false })).toBe(
      'Deal 12 damage. Consume 1 Embryo: apply 6 Bleed and add a free Fleeting copy to your hand.',
    );
  });
});

describe('the Boss', () => {
  const BOSS = { kind: 'boss', content: 'encounter.hollow-abbess' } as const;
  const at = (clock: number, tile: Tile = BOSS) => expeditionFight({ ...go(on({ kind: 'entrance' }, tile), '1,0').at(-1)!, clock }, registry);

  it('every board ends in the Hollow Abbess', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const tiles = Object.values(startExpedition(seed, PARTY, M3_EXPEDITION, registry.motifs).board.tiles);
      expect(tiles.filter((t) => t.kind === 'boss').map((t) => t.content)).toEqual(['encounter.hollow-abbess']);
    }
  });

  it('the Bloom never scales her; a fight with her that starts at Fruiting is Full Bloom', () => {
    expect([0, 3, 6, 9, 11].map((clock) => [at(clock).enemies, at(clock).enemyScale])).toEqual(
      Array.from({ length: 5 }, () => [['enemy.hollow-abbess'], undefined]),
    );
    expect([at(12).enemies, at(12).enemyScale]).toEqual([['enemy.hollow-abbess-full-bloom'], undefined]);
    // Other fights still scale.
    expect(at(12, HOUND).enemyScale).toBe(50);
  });
});

describe('banking', () => {
  const ELITE = { kind: 'elite', content: 'encounter.thorn-wall' } as const;
  const BOSS = { kind: 'boss', content: 'encounter.hollow-abbess' } as const;
  /** Walks the row fight by fight, winning each and skipping its pick, and ends the last fight as given. */
  function play(tiles: Tile[], last: 'victory' | 'defeat', clock = 0): Expedition {
    let exp = { ...on({ kind: 'entrance' }, ...tiles), clock };
    tiles.forEach((_, i) => {
      exp = go(exp, `${i + 1},0`).at(-1)!;
      exp = finishExpeditionFight(exp, ended(exp, i === tiles.length - 1 ? last : 'victory', 150), M3_EXPEDITION, registry);
      if (exp.phase === 'reward') exp = exp.offeredCards.length > 0 ? chooseExpeditionCard(exp, null) : chooseExpeditionRelic(exp, null);
    });
    return exp;
  }
  const banked = (exp: Expedition, end: 'won' | 'lost' | 'abandoned' = exp.phase as 'won' | 'lost') => runBanking(exp, end, M3_EXPEDITION, itemCount);
  const { materials } = M3_EXPEDITION.banking;

  // M5.5 (owner, 29 Oct): Memories and Ducats bank with the pulls, and a won run's Boss gives a material.
  it('a win banks 5 pulls however many elites fell, with Memories and Ducats for the Boss, each fight and each elite, and the Boss\'s material', () => {
    const alone = play([BOSS], 'victory');
    expect(materials).toContain(alone.material);
    expect(banked(alone)).toEqual({
      pulls: 5,
      items: { 'memory.vivid': 1, money: 500, [alone.material!]: 1 },
      lines: ['The Boss beaten: 5 Purified Blooms, 1 Vivid Memory, 500 Ducats', `The Boss's material: ${itemCount(alone.material!, 1)}`],
    });
    const past = play([HOUND, ELITE, HOUND, ELITE, BOSS], 'victory');
    expect([past.phase, past.elites, past.fights]).toEqual(['won', 2, 2]);
    expect(banked(past)).toEqual({
      pulls: 5,
      items: { 'memory.vivid': 1, 'memory.faint': 2, 'memory.clear': 2, money: 500 + 2 * 50 + 2 * 150, [past.material!]: 1 },
      lines: [
        'The Boss beaten: 5 Purified Blooms, 1 Vivid Memory, 500 Ducats',
        '2 fights won: 2 Faint Memories, 100 Ducats',
        '2 elites beaten: 2 Clear Memories, 300 Ducats',
        `The Boss's material: ${itemCount(past.material!, 1)}`,
      ],
    });
  });

  it('a win over the Boss at Fruiting banks double, but her material only once', () => {
    const exp = play([BOSS], 'victory', 12);
    expect(banked(exp)).toEqual({
      pulls: 10,
      items: { 'memory.vivid': 2, money: 1000, [exp.material!]: 1 },
      lines: ['The Boss beaten: 5 Purified Blooms, 1 Vivid Memory, 500 Ducats', 'The Boss at Fruiting: ×2', `The Boss's material: ${itemCount(exp.material!, 1)}`],
    });
    // Fruiting reached by fights on the way counts too: the Boss's own fight never ticks the clock.
    expect(banked(play([ELITE, BOSS], 'victory', 11))).toMatchObject({ pulls: 10, items: { 'memory.vivid': 2, 'memory.clear': 2, money: 1300 } });
  });

  it('a defeat banks 1 pull, 1 Clear Memory and 150 Ducats per elite beaten, 3 at most, and no material', () => {
    expect(banked(play([HOUND], 'defeat'))).toEqual({ pulls: 0, lines: ['No elites beaten: nothing banked'] });
    expect(banked(play([ELITE, HOUND], 'defeat'))).toEqual({ pulls: 1, items: { 'memory.clear': 1, money: 150 }, lines: ['1 elite beaten: 1 Purified Bloom, 1 Clear Memory, 150 Ducats'] });
    expect(banked(play([ELITE, ELITE, BOSS], 'defeat'))).toEqual({ pulls: 2, items: { 'memory.clear': 2, money: 300 }, lines: ['2 elites beaten: 2 Purified Blooms, 2 Clear Memories, 300 Ducats'] });
    expect(banked(play([ELITE, ELITE, ELITE, ELITE, HOUND], 'defeat'))).toEqual({
      pulls: 3,
      items: { 'memory.clear': 3, money: 450 },
      lines: ['4 elites beaten: 3 Purified Blooms, 3 Clear Memories, 450 Ducats (3 at most)'],
    });
    expect(play([ELITE, ELITE, BOSS], 'defeat').material).toBeUndefined();
  });

  it('an abandoned run banks like a defeat, so a run quit before any progress banks nothing', () => {
    expect(banked(startExpedition(1, PARTY, M3_EXPEDITION, registry.motifs), 'abandoned')).toEqual({ pulls: 0, lines: ['No elites beaten: nothing banked'] });
    expect(banked(play([HOUND, HOUND], 'victory'), 'abandoned').pulls).toBe(0);
    expect(banked(play([ELITE, HOUND], 'victory'), 'abandoned')).toMatchObject({ pulls: 1, items: { 'memory.clear': 1, money: 150 } });
  });

  it("only elite tiles count: an elite's roster on a normal tile (Flowering) is a normal fight", () => {
    const exp = play([{ kind: 'fight', content: 'encounter.thorn-wall' }, HOUND], 'defeat');
    expect([exp.elites, exp.fights]).toEqual([0, 1]);
  });

  // M6.4 (owner, 29 and 31 Oct): a run's depth multiplies its Memories and Ducats.
  it("at a depth, a run's Memories and Ducats are multiplied, each rounded down, but not its Blooms or material", () => {
    const won = { ...play([HOUND, ELITE, HOUND, ELITE, BOSS], 'victory'), depth: 12 };
    // Depth 12 is ×3.75: 1 Vivid, 2 Faint, 2 Clear and 900 Ducats become 3, 7, 7 and 3,375.
    expect(banked(won)).toEqual({
      pulls: 5,
      items: { 'memory.vivid': 3, 'memory.faint': 7, 'memory.clear': 7, money: 3375, [won.material!]: 1 },
      lines: [
        'The Boss beaten: 5 Purified Blooms, 1 Vivid Memory, 500 Ducats',
        '2 fights won: 2 Faint Memories, 100 Ducats',
        '2 elites beaten: 2 Clear Memories, 300 Ducats',
        'Depth 12: Memories and Ducats ×3.75',
        `The Boss's material: ${itemCount(won.material!, 1)}`,
      ],
      won: 12,
    });
    expect(banked({ ...play([ELITE, ELITE, HOUND], 'defeat'), depth: 12 })).toEqual({
      pulls: 2,
      items: { 'memory.clear': 7, money: 1125 },
      lines: ['2 elites beaten: 2 Purified Blooms, 7 Clear Memories, 1,125 Ducats', 'Depth 12: Memories and Ducats ×3.75'],
    });
  });

  it("a run's fights field enemies at its depth's level", () => {
    const deep = { ...on({ kind: 'entrance' }, HOUND), depth: 12 };
    expect(expeditionFight(go(deep, '1,0').at(-1)!, registry).enemyLevel).toBe(12);
    expect(expeditionFight(go(on({ kind: 'entrance' }, HOUND), '1,0').at(-1)!, registry).enemyLevel).toBeUndefined();
    expect(startExpedition(1, PARTY, M3_EXPEDITION, registry.motifs, {}, 12).depth).toBe(12);
    expect(startExpedition(1, PARTY, M3_EXPEDITION, registry.motifs, {}, 1).depth).toBeUndefined();
  });

  it('banking adds the pulls and items to the profile and counts the run', () => {
    // A new profile starts with 10.
    const win = play([BOSS], 'victory');
    const once = bank(NEW_PROFILE, banked(win));
    expect(once).toEqual({ pulls: 10 + 5, runs: 1, owned: [], items: { 'memory.vivid': 1, money: 500, [win.material!]: 1 } });
    expect(bank(once, banked(play([HOUND], 'defeat')))).toEqual({ ...once, runs: 2 });
    expect(bank(once, banked(play([ELITE, HOUND], 'defeat'))).items).toEqual({ 'memory.vivid': 1, 'memory.clear': 1, money: 650, [win.material!]: 1 });
  });

  it('a win records the deepest depth won, and a shallower win or a loss leaves it', () => {
    const at = (depth: number, last: 'victory' | 'defeat' = 'victory') => banked({ ...play([BOSS], last), depth });
    const ten = bank(NEW_PROFILE, at(10));
    expect(ten.deepest).toBe(10);
    expect(bank(ten, at(4)).deepest).toBe(10);
    expect(bank(ten, at(14, 'defeat')).deepest).toBe(10);
    expect(bank(ten, at(14)).deepest).toBe(14);
    expect(bank(NEW_PROFILE, at(1)).deepest).toBeUndefined();
  });
});

describe("Symptoms and the run's deck", () => {
  it('a taken Symptom is dealt into every later fight, played by the front member', () => {
    const paid = takeSymptom(enter(on({ kind: 'entrance' }, SYMPTOM, HOUND)));
    const fight = expeditionFight(go(paid, '2,0').at(-1)!, registry);
    expect(fight.deck).toEqual([{ card: 'symptom.grafted-hand' }]);
    const cards = startCombat(fight, registry).state.piles;
    const dealt = [...cards.draw, ...cards.hand].filter((c) => c.card === 'symptom.grafted-hand');
    expect(dealt.map((c) => c.owner)).toEqual(['m0']);
  });

  it("the tile shows the card's text with the HP cost for the party as it stands", () => {
    const exp = { ...on({ kind: 'entrance' }), hp: 150 };
    expect(symptomText(exp, 'symptom.fevered-pulse', registry)).toBe('Exhaust. Gain 2 Mana. The party loses 6 HP (4% of current).');
    expect(symptomText(exp, 'symptom.sweet-rot', registry)).toBe("Deal 14 damage. Every enemy and the party gain 2 Poison (1% of the party's max HP).");
  });
});

describe('Events', () => {
  const at = (content: string, extra: Partial<Expedition> = {}) => ({ ...enter(on({ kind: 'entrance' }, { kind: 'event', content })), ...extra });
  const choose = (exp: Expedition, i: number) => chooseEvent(exp, i, M3_EXPEDITION, registry);
  const lines = (exp: Expedition) => registry.events[exp.board.tiles[exp.board.at]!.content!]!.choices.map((c) => describeChoice(exp, c, registry));
  const COMMONS = ['relic.brass-thimble', 'relic.seed-packet'];

  it('The Abandoned Survey Pack: 30 Obols, or a random Common relic for 10% of current HP', () => {
    const pack = at('event.survey-pack', { hp: 150 });
    expect(lines(pack)).toEqual([['Gain 30 Obols.'], ['Gain a random Common relic.', 'The party loses 15 HP (10% of current).']]);
    const obols = choose(pack, 0);
    expect([obols.obols, obols.clock, obols.phase, obols.outcome]).toEqual([30, 1, 'outcome', { event: 'event.survey-pack', obols: 30, ticks: 1 }]);
    const tin = choose(pack, 1);
    expect(COMMONS).toContain(tin.relics[0]);
    expect([tin.hp, tin.outcome]).toEqual([135, { event: 'event.survey-pack', relic: tin.relics[0], hp: -15, ticks: 1 }]);
    expect(closeOutcome(tin).phase).toBe('map');
    expect(cannotChoose({ ...pack, relics: COMMONS }, 1, M3_EXPEDITION, registry)).toBe('No Common relic is left.');
  });

  it('The Censer Left Burning: 20 charge for every member and the Symptom it shows, or nothing', () => {
    const censer = at('event.censer', { gauges: [0, 50, 90, 100] });
    const card = censer.board.tiles['1,0']!.card!;
    expect(registry.cards[card]!.owner).toBeUndefined();
    expect(lines(censer)).toEqual([['Every party member gains 20 ultimate charge.', `Take the Symptom ${registry.cards[card]!.name}.`], ['Nothing happens.']]);
    const breathed = choose(censer, 0);
    expect([breathed.gauges, breathed.deck, breathed.outcome]).toEqual([[20, 70, 100, 100], [{ card }], { event: 'event.censer', charge: 20, card, ticks: 1 }]);
    const snuffed = choose(censer, 1);
    expect([snuffed.gauges, snuffed.deck, snuffed.clock, snuffed.board.tiles['1,0']!.kind]).toEqual([[0, 50, 90, 100], [], 1, 'path']);
  });

  it('The Kneeling Gardener: heal 15% of max HP, or a random Uncommon relic and one more tick', () => {
    const gardener = at('event.kneeling-gardener', { hp: 100 });
    const healed = choose(gardener, 0);
    expect([healed.hp, healed.outcome]).toEqual([100 + Math.floor(MAX_HP * 0.15), { event: 'event.kneeling-gardener', hp: Math.floor(MAX_HP * 0.15), ticks: 1 }]);
    expect(choose({ ...gardener, hp: MAX_HP - 3 }, 0).hp).toBe(MAX_HP);
    const shears = choose(gardener, 1);
    expect(['relic.cracked-reliquary', 'relic.vigil-wax']).toContain(shears.relics[0]);
    expect([shears.clock, shears.outcome!.ticks]).toEqual([2, 2]);
  });

  it('The Seed Vault: 40 Obols for a random Rare relic, or leave', () => {
    const vault = at('event.seed-vault', { obols: 50 });
    const paid = choose(vault, 0);
    expect(['relic.midwifes-shears', 'relic.choir-bell']).toContain(paid.relics[0]);
    expect([paid.obols, paid.outcome!.obols]).toEqual([10, -40]);
    expect(cannotChoose({ ...vault, obols: 39 }, 0, M3_EXPEDITION, registry)).toBe('Not enough Obols.');
    expect(() => choose({ ...vault, obols: 39 }, 0)).toThrow('Not enough Obols.');
    const left = choose(vault, 1);
    expect([left.obols, left.relics, left.clock]).toEqual([50, [], 1]);
  });

  it("an Event's Symptom card is rolled on first entry from the seed, and kept", () => {
    const censer = at('event.censer');
    expect(at('event.censer').board.tiles['1,0']!.card).toBe(censer.board.tiles['1,0']!.card);
    expect(at('event.survey-pack').board.tiles['1,0']!.card).toBeUndefined();
  });
});

describe('Bloom nodes', () => {
  const PATHS = Array.from({ length: 12 }, () => ({ kind: 'path' }) as const);
  /** A row with the Boss at the far end, at Fruiting. */
  const fruiting = (extra: Partial<Expedition> = {}) => ({ ...on({ kind: 'entrance' }, ...PATHS, { kind: 'boss', content: 'encounter.hound' }), clock: 12, ...extra });
  const nodes = (exp: Expedition) => Object.keys(exp.board.tiles).filter((k) => exp.board.tiles[k]!.kind === 'bloom');
  const NODE = { kind: 'bloom', content: 'encounter.hound', card: 'symptom.pollen-lung' } as const;

  it('appear only from Fruiting on', () => {
    const before = go({ ...fruiting(), clock: 11, bloomDue: 1 }, '3,0').at(-1)!;
    expect([nodes(before), before.bloomDue]).toEqual([[], 1]);
  });

  it('one appears once the tiles due are walked, then the next is due in 6 to 10', () => {
    const walked = go(fruiting({ bloomDue: 3 }), '2,0').at(-1)!;
    expect([nodes(walked), walked.bloomDue]).toEqual([[], 1]);
    const sown = go(walked, '3,0').at(-1)!;
    expect(nodes(sown)).toHaveLength(1);
    expect(sown.bloomDue).toBeGreaterThanOrEqual(6);
    expect(sown.bloomDue).toBeLessThanOrEqual(10);
    const dues = new Set(Array.from({ length: 100 }, (_, seed) => bloomNodeDue(createStreams(seed, ['bloom']), 'bloom')));
    expect([...dues].sort()).toEqual([10, 6, 7, 8, 9]);
  });

  it('sits on a path tile within 3, ahead of the party where it can, with a fight and a Symptom', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const near = go({ ...fruiting({ bloomDue: 10 }), rng: createStreams(seed, EXPEDITION_STREAMS) }, '2,0').at(-1)!;
      const sown = go({ ...near, bloomDue: 1 }, '5,0').at(-1)!;
      const [node] = nodes(sown);
      const q = Number(node!.split(',')[0]);
      expect(q, `seed ${seed}`).toBeGreaterThan(5);
      expect(q).toBeLessThanOrEqual(8);
      const tile = sown.board.tiles[node!]!;
      expect(M3_EXPEDITION.board.encounters.fight).toContain(tile.content);
      expect(M3_EXPEDITION.board.symptoms).toContain(tile.card);
    }
    // Nothing ahead but the Boss: it goes behind.
    const end = go({ ...on({ kind: 'entrance' }, { kind: 'path' }, { kind: 'path' }, { kind: 'boss', content: 'encounter.hound' }), clock: 12, bloomDue: 1 }, '2,0').at(-1)!;
    expect(nodes(end)).toEqual(['1,0']);
  });

  it('force a choice; the fight is the normal fight it holds, and winning it gives Obols but no tick', () => {
    const node = enter({ ...on({ kind: 'entrance' }, NODE, { kind: 'path' }), clock: 12 });
    expect([node.phase, canMove(node), move(node, '2,0', M3_EXPEDITION, registry)]).toEqual(['tile', false, undefined]);
    const fight = chooseBloom(node, 'fight', registry);
    expect([fight.phase, expeditionFight(fight, registry).enemies]).toEqual(['fight', ['enemy.bloom-rib-hound']]);
    const won = finishExpeditionFight(fight, ended(fight, 'victory', 150), M3_EXPEDITION, registry);
    expect([won.phase, won.obols, won.clock, won.board.tiles['1,0']]).toEqual(['reward', 30, 12, { kind: 'path' }]);
  });

  it('the gamble loses or heals 10% of current HP (healing only up to full), 50/50', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const node = enter({ ...on({ kind: 'entrance' }, NODE), clock: 12, hp: 150, rng: createStreams(seed, EXPEDITION_STREAMS) });
      const gambled = chooseBloom(node, 'gamble', registry);
      results.add(gambled.outcome!.hp!);
      expect(gambled.hp).toBe(150 + gambled.outcome!.hp!);
      expect([gambled.phase, gambled.clock, gambled.board.tiles['1,0']]).toEqual(['outcome', 12, { kind: 'path' }]);
    }
    expect([...results].sort((a, b) => a - b)).toEqual([-15, 15]);
    const full = enter({ ...on({ kind: 'entrance' }, NODE), clock: 12, hp: MAX_HP - 4 });
    expect([MAX_HP - 4 - Math.floor((MAX_HP - 4) / 10), MAX_HP]).toContain(chooseBloom(full, 'gamble', registry).hp);
  });

  it('taking the Symptom adds its card to the deck, with no tick', () => {
    const took = chooseBloom(enter({ ...on({ kind: 'entrance' }, NODE), clock: 12 }), 'symptom', registry);
    expect([took.deck, took.outcome, took.clock, took.board.tiles['1,0']]).toEqual([[{ card: 'symptom.pollen-lung' }], { card: 'symptom.pollen-lung' }, 12, { kind: 'path' }]);
  });
});

// Golden replay: a scripted party explores a whole board and makes the Boss its last stop. It
// stops on every fight and choice it finds, rests when hurt, buys what it can afford and takes the
// first open Event choice, cycling through a Bloom node's three choices. Update on purpose with
// `npx vitest -u`.
describe('a whole Labyrinth run', () => {
  /** Fire a charged ultimate, else play the first playable card at the first living enemy, else end the turn. */
  function combatPolicy(state: CombatState): Command {
    const charged = state.members.find((m) => validate(state, { type: 'fireUltimate', member: m.id }, registry) === undefined);
    if (charged) return { type: 'fireUltimate', member: charged.id };
    const target = state.enemies.find((e) => e.hp > 0)?.id;
    for (const card of state.piles.hand) {
      for (const command of [{ type: 'playCard', card: card.uid }, { type: 'playCard', card: card.uid, target }] as Command[]) {
        if (validate(state, command, registry) === undefined) return command;
      }
    }
    return { type: 'endTurn' };
  }

  /** What happens to the run between decisions: nothing, or a save and a load (`reloaded`). */
  type Between = (exp: Expedition, combat?: CombatState) => { exp: Expedition; combat?: CombatState };
  const asIs: Between = (exp, combat) => ({ exp, ...(combat ? { combat } : {}) });
  /** Writes the run as the game saves it and reads it back. */
  const reloaded: Between = (exp, combat) => {
    const text = encodeSave(RUN_SAVE, { id: 'run', seed: 7, exp, ...(combat ? { combat } : {}) }, CONTENT_VERSION);
    return decodeSave(RUN_SAVE, text, CONTENT_VERSION).data;
  };

  function fightOut(exp: Expedition, between: Between): CombatState {
    let state = between(exp, startCombat(expeditionFight(exp, registry), registry).state).combat!;
    for (let step = 0; step < 500 && state.phase !== 'ended'; step++) {
      const result = apply(state, combatPolicy(state), registry);
      if (!result.ok) throw new Error(result.reason);
      state = between(exp, result.state).combat!;
    }
    return state;
  }

  /**
   * Where to walk next: the nearest tile with something on it, else the nearest tile still in fog,
   * else the Boss, else a Collapsing tile. Shops and Camps it has left don't count again.
   */
  function destination(exp: Expedition, left: Set<string>): string | undefined {
    const board = exp.board;
    const wanted = (key: string): number | undefined => {
      const kind = visibleKind(board, key);
      const tile = board.tiles[key]!;
      if (kind === 'unknown') return 1;
      if (kind === 'boss') return 2;
      if (kind === 'collapsing') return 3;
      if (kind === 'shop' || kind === 'camp') return left.has(key) ? undefined : 0;
      return kind !== undefined && stopsOn(tile) ? 0 : undefined;
    };
    let best: { key: string; rank: number; steps: number } | undefined;
    for (const key of board.seen) {
      const rank = wanted(key);
      const steps = rank === undefined ? undefined : routeTo(board, key)?.length;
      if (rank === undefined || steps === undefined) continue;
      if (!best || rank < best.rank || (rank === best.rank && steps < best.steps)) best = { key, rank, steps };
    }
    return best?.key;
  }

  function play(seed: number, between = asIs): string[] {
    let exp = startExpedition(seed, PARTY, M3_EXPEDITION, registry.motifs);
    const left = new Set<string>();
    const log: string[] = [];
    const note = (line: string) => log.push(`${line} | HP ${exp.hp ?? 'full'}, clock ${exp.clock}, ${exp.obols} Obols`);
    let blooms = 0;
    for (let decision = 0; decision < 400 && exp.phase !== 'won' && exp.phase !== 'lost'; decision++) {
      exp = between(exp).exp;
      const here = exp.board.at;
      const tile = exp.board.tiles[here]!;
      if (exp.phase === 'map' || (exp.phase === 'tile' && canMove(exp) && left.has(here))) {
        const to = destination(exp, left);
        if (to === undefined) throw new Error('Nowhere left to walk.');
        exp = go(exp, to).at(-1)!;
      } else if (exp.phase === 'fight') {
        const content = tile.content;
        const combat = fightOut(exp, between);
        exp = finishExpeditionFight(exp, combat, M3_EXPEDITION, registry);
        note(`${here} ${tile.kind} ${content}: ${combat.outcome} on turn ${combat.turn}`);
      } else if (exp.phase === 'reward') {
        const relic = exp.offered[0] ?? null;
        const card = exp.offeredCards[0];
        const obols = exp.spoils?.obols;
        exp = card ? chooseExpeditionCard(exp, 0) : chooseExpeditionRelic(exp, relic);
        note(`  +${obols} Obols${relic ? `, took ${relic}` : ''}${card ? `, took ${card.card} for ${card.owner}` : ''}`);
      } else if (exp.phase === 'outcome') {
        note(`  ${JSON.stringify(exp.outcome)}`);
        exp = closeOutcome(exp);
      } else if (tile.kind === 'shop') {
        const bought: string[] = [];
        for (const offer of [...shopHere(exp)!.relics].sort((a, b) => a.price - b.price)) {
          if (cannotBuy(exp, offer.relic) === undefined) {
            exp = buyRelic(exp, offer.relic);
            bought.push(offer.relic);
          }
        }
        const mended = cannotMend(exp, registry) === undefined;
        if (mended) exp = mend(exp, registry);
        left.add(here);
        note(`${here} shop: bought ${bought.join(', ') || 'nothing'}${mended ? ', mended' : ''}`);
        exp = leaveTile(exp);
      } else if (tile.kind === 'camp') {
        if (cannotRest(exp, M3_EXPEDITION, registry) === undefined) {
          exp = rest(exp, M3_EXPEDITION, registry);
          note(`${here} camp: rested`);
        } else {
          left.add(here);
          note(`${here} camp: kept for later`);
          exp = leaveTile(exp);
        }
      } else if (tile.kind === 'event') {
        const event = eventHere(exp, registry)!;
        const index = event.choices.findIndex((_, i) => cannotChoose(exp, i, M3_EXPEDITION, registry) === undefined);
        exp = chooseEvent(exp, index, M3_EXPEDITION, registry);
        note(`${here} ${event.id}: choice ${index + 1}`);
      } else if (tile.kind === 'symptom') {
        exp = takeSymptom(exp);
        note(`${here} symptom: took ${tile.card}`);
      } else if (onBloomNode(exp)) {
        const choice = (['fight', 'gamble', 'symptom'] as const)[blooms++ % 3]!;
        exp = chooseBloom(exp, choice, registry);
        note(`${here} bloom node: ${choice}`);
      } else throw new Error(`Stuck in ${exp.phase} on ${tile.kind}.`);
    }
    log.push(`run ${exp.phase}: HP ${exp.hp}, clock ${exp.clock}, ${exp.obols} Obols`);
    log.push(`  relics ${exp.relics.join(', ') || 'none'}`);
    log.push(`  deck ${exp.deck.map((c) => (c.owner ? `${c.card} (${c.owner})` : c.card)).join(', ') || 'empty'}`);
    return log;
  }

  it('the scripted party can play every board to the end', () => {
    for (let seed = 1; seed <= 30; seed++) expect(play(seed).at(-3)).toMatch(/^run (won|lost)/);
  });

  it('a scripted run replays exactly', async () => {
    await expect(play(7).join('\n') + '\n').toMatchFileSnapshot('golden/labyrinth.txt');
  });

  it('saved and loaded before every decision and after every combat command, a run plays on identically', async () => {
    await expect(play(7, reloaded).join('\n') + '\n').toMatchFileSnapshot('golden/labyrinth.txt');
    for (const seed of [2, 11]) expect(play(seed, reloaded)).toEqual(play(seed));
  });
});
