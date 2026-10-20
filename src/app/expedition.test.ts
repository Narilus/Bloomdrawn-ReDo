import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { startCombat, type CombatState } from '../engine/index.ts';
import { createBoard, type Tile } from '../game/board.ts';
import {
  buyRelic,
  canMove,
  cannotBuy,
  cannotMend,
  chooseExpeditionRelic,
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
import { hexKey } from '../game/hex.ts';

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

  it('on an unpaid Symptom the party must take it or turn back; it cannot walk on past', () => {
    const toll = go(on({ kind: 'entrance' }, { kind: 'symptom' }, { kind: 'path' }), '1,0').at(-1)!;
    expect([toll.phase, canMove(toll), move(toll, '2,0', M3_EXPEDITION, registry)]).toEqual(['tile', false, undefined]);
    expect(turnBack(toll)!.board.at).toBe('0,0');
    const paid = leaveTile(toll, M3_EXPEDITION);
    expect([paid.phase, paid.board.tiles['1,0']!.paid]).toEqual(['map', true]);
    expect(go(paid, '2,0').at(-1)!.board.at).toBe('2,0');
  });

  it('a Shop is looked at and left, and stays; an Event is used up', () => {
    const shop = go(on({ kind: 'entrance' }, { kind: 'shop' }, { kind: 'event' }), '1,0').at(-1)!;
    expect([shop.phase, canMove(shop)]).toEqual(['tile', true]);
    const event = go(shop, '2,0').at(-1)!;
    expect(event.board.tiles['1,0']!.kind).toBe('shop');
    expect(leaveTile(event, M3_EXPEDITION).board.tiles['2,0']).toEqual({ kind: 'path' });
  });
});

describe('the Bloom clock on a run', () => {
  const EVENT = { kind: 'event' } as const;

  it('ticks on a won fight and on an Event; walking, Shops and Symptoms leave it', () => {
    const fighting = go(on({ kind: 'entrance' }, HOUND, { kind: 'shop' }, EVENT), '1,0').at(-1)!;
    const won = chooseExpeditionRelic(finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION), null);
    expect(won.clock).toBe(1);
    const shop = leaveTile(go(won, '2,0').at(-1)!, M3_EXPEDITION);
    expect(shop.clock).toBe(1);
    expect(leaveTile(go(shop, '3,0').at(-1)!, M3_EXPEDITION).clock).toBe(2);
    const toll = go(on({ kind: 'entrance' }, { kind: 'symptom' }), '1,0').at(-1)!;
    expect(leaveTile(toll, M3_EXPEDITION).clock).toBe(0);
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
