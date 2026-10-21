import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { startCombat, type CombatState } from '../engine/index.ts';
import { createBoard, type Tile } from '../game/board.ts';
import {
  buyRelic,
  canMove,
  cannotBuy,
  cannotMend,
  cannotChoose,
  cannotRest,
  chooseBloom,
  chooseEvent,
  chooseExpeditionRelic,
  closeOutcome,
  describeChoice,
  rest,
  symptomText,
  takeSymptom,
  expeditionFight,
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
    const after = chooseExpeditionRelic(finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION), null);
    expect([after.phase, after.hp, after.gauges, after.board.tiles['1,0']]).toEqual(['map', 150, [40, 40, 40, 40], { kind: 'path' }]);
    const next = expeditionFight(go(after, '2,0').at(-1)!, registry);
    expect([next.partyHp, next.gauges]).toEqual([150, [40, 40, 40, 40]]);
  });

  it('an elite offers three relics; the Boss ends the run in victory; a loss ends it in defeat', () => {
    const elite = go(on({ kind: 'entrance' }, { kind: 'elite', content: 'encounter.thorn-wall' }), '1,0').at(-1)!;
    const reward = finishExpeditionFight(elite, ended(elite, 'victory', 120), M3_EXPEDITION);
    expect(reward.phase).toBe('reward');
    expect(reward.offered).toHaveLength(3);
    const picked = chooseExpeditionRelic(reward, reward.offered[0]!);
    expect([picked.phase, picked.relics]).toEqual(['map', [reward.offered[0]]]);

    const boss = go(on({ kind: 'entrance' }, { kind: 'boss', content: 'encounter.hound-mother' }), '1,0').at(-1)!;
    expect(finishExpeditionFight(boss, ended(boss, 'victory', 60), M3_EXPEDITION).phase).toBe('won');
    expect(finishExpeditionFight(boss, ended(boss, 'defeat', 0), M3_EXPEDITION).phase).toBe('lost');
  });

  it('on an unpaid Symptom the party must take its card or turn back; it cannot walk on past', () => {
    const toll = go(on({ kind: 'entrance' }, SYMPTOM, { kind: 'path' }), '1,0').at(-1)!;
    expect([toll.phase, canMove(toll), move(toll, '2,0', M3_EXPEDITION, registry)]).toEqual(['tile', false, undefined]);
    expect(turnBack(toll)!.board.at).toBe('0,0');
    const paid = takeSymptom(toll);
    expect([paid.phase, paid.board.tiles['1,0']!.paid, paid.deck]).toEqual(['map', true, ['symptom.grafted-hand']]);
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
    const won = chooseExpeditionRelic(finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION), null);
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
  const win = (exp: Expedition) => finishExpeditionFight(exp, ended(exp, 'victory', 150), M3_EXPEDITION);

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

describe("Symptoms and the run's deck", () => {
  it('a taken Symptom is dealt into every later fight, played by the front member', () => {
    const paid = takeSymptom(enter(on({ kind: 'entrance' }, SYMPTOM, HOUND)));
    const fight = expeditionFight(go(paid, '2,0').at(-1)!, registry);
    expect(fight.deck).toEqual(['symptom.grafted-hand']);
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
    expect([breathed.gauges, breathed.deck, breathed.outcome]).toEqual([[20, 70, 100, 100], [card], { event: 'event.censer', charge: 20, card, ticks: 1 }]);
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
      const near = go({ ...fruiting({ bloomDue: 10 }), rng: createStreams(seed, ['fights', 'rewards', 'bloom', 'shops', 'events']) }, '2,0').at(-1)!;
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
    const won = finishExpeditionFight(fight, ended(fight, 'victory', 150), M3_EXPEDITION);
    expect([won.phase, won.obols, won.clock, won.board.tiles['1,0']]).toEqual(['reward', 30, 12, { kind: 'path' }]);
  });

  it('the gamble loses or heals 10% of current HP (healing only up to full), 50/50', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const node = enter({ ...on({ kind: 'entrance' }, NODE), clock: 12, hp: 150, rng: createStreams(seed, ['fights', 'rewards', 'bloom', 'shops', 'events']) });
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
    expect([took.deck, took.outcome, took.clock, took.board.tiles['1,0']]).toEqual([['symptom.pollen-lung'], { card: 'symptom.pollen-lung' }, 12, { kind: 'path' }]);
  });
});
