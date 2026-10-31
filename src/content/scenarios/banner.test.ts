import { describe, expect } from 'vitest';
import { describeCardLive, type CombatState } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario, type ScenarioPlay } from '../testing/scenario.ts';

// The banner four (docs/notes/banner-kits.md, reviewed by the owner 25 Oct), one scenario or more
// per card, passive, ultimate, Transcend and reward card. The party is one per Domain: Virelle
// (Attack 18, Defense 6), Isadora (15, 9), Kibane (15, 9) and Hester (12, 12), against 600-HP
// training dummies. Nobody starts with a Tentacle, so the end-of-turn volley does nothing until
// Isadora makes some. Card numbers are ratios of the owner's stats (docs/notes/m6-scaling.md); damage
// per hit starts at 80% of the party's average Attack, 12 for these four, and each gain is a share of
// its card owner's Attack (Isadora's 20%: 3).
const BANNER = ['virelle', 'isadora', 'kibane', 'hester'];
const DUMMY = 'enemy.training-dummy';
const BIG = 'enemy.practice-dummy';
const HOUND = 'enemy.bloom-rib-hound';
const ELITE = 'enemy.hound-mother';

/** Each enemy's statuses as [name, stacks]. */
const marks = (state: CombatState) => state.enemies.map((e) => e.statuses.map((s) => [s.status.replace('status.', ''), s.stacks]));
const transcended = (state: CombatState, who: string) => state.members.find((m) => m.character === who)?.transcended;

/** Every damage, HP loss and Shield number the preview showed (branches included) is what the play did. */
function previewMatchesResult({ preview, events }: ScenarioPlay) {
  const flat = (ps: ScenarioPlay['preview']): ScenarioPlay['preview'] => ps.flatMap((p) => [p, ...(p.resolves === false ? [] : flat(p.branch ?? []))]);
  const shown = flat(preview).filter((p) => ['damage', 'loseHp', 'gainShield', 'volley'].includes(p.op));
  const done = events.filter((e) => e.type === 'damageDealt' || e.type === 'shieldGained');
  expect(shown.length).toBeGreaterThan(0);
  expect(done.map((e) => [e.target, e.amount, e.absorbed ?? 0])).toEqual(shown.map((p) => [p.target, p.amount, p.absorbed ?? 0]));
}

describe('Strikes and Defenses', () => {
  // 350% of 6, 267% of 9 and 225% of 12.
  const SHIELD: Record<string, number> = { virelle: 21, isadora: 24, kibane: 24, hester: 27 };
  // 200% of 18, 220% of 15 and 250% of 12.
  const STRIKE: Record<string, number> = { virelle: 36, isadora: 33, kibane: 33, hester: 30 };
  for (const who of BANNER) {
    scenario(`${who}: Strike then Defense, preview equals result`, {
      party: BANNER,
      setup: { hand: [`${who}.strike`, `${who}.defense`] },
      play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
      expect: { enemyHp: [600 - (STRIKE[who] as number)], partyShield: SHIELD[who] as number, mana: 4, gauges: { [who]: 20 } },
      check: ({ plays }) => plays.forEach(previewMatchesResult),
    });
  }
});

describe('Virelle', () => {
  scenario('Strike chains while Embryo lasts: each costs 1 Embryo for 100% of her Attack in Bleed and a free Fleeting copy, 10% more per Strike before it', {
    party: BANNER,
    setup: { hand: ['virelle.strike'], resources: { embryo: 2 } },
    play: [
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
    ],
    // 36, then 36 × 1.1, × 1.2 and × 1.3, rounded down. Opened Vein gives back the first Embryo, so three
    // copies come, each with 18 Bleed; the last one finds no Embryo and makes none. Only the first Strike
    // costs Mana, and every one charges her ultimate.
    expect: { enemyHp: [600 - 36 - 39 - 43 - 46], resources: { embryo: 0 }, mana: 5, gauges: { virelle: 40 } },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 54]]]);
      expect(state.piles.hand).toEqual([]);
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['virelle.strike', 'virelle.strike', 'virelle.strike']);
      expect(state.piles.discard.map((c) => c.card)).toEqual(['virelle.strike']);
      plays.forEach(previewMatchesResult);
    },
  });

  scenario("Strike counts any member's Strikes played before it this turn", {
    party: BANNER,
    setup: { hand: ['hester.strike', 'kibane.strike', 'virelle.strike'] },
    play: [{ card: 'hester.strike', target: 0 }, { card: 'kibane.strike', target: 0 }, { card: 'virelle.strike', target: 0 }],
    // 30, 33, then 36 × 1.2.
    expect: { enemyHp: [600 - 30 - 33 - 43] },
  });

  scenario("Strike's text in hand shows its damage as it grows with each Strike played", {
    party: BANNER,
    setup: { hand: ['hester.strike', 'kibane.strike', 'virelle.strike'] },
    play: [{ card: 'hester.strike', target: 0 }, { card: 'kibane.strike', target: 0 }],
    check: ({ state }) => {
      const strike = state.piles.hand.find((c) => c.card === 'virelle.strike')!;
      expect(describeCardLive(strike, state, registry, { charge: false })).toBe(
        'Deal 43 damage. Consume 1 Embryo: apply 18 Bleed and add a free Fleeting copy to your hand.',
      );
    },
  });

  scenario('Strike without Embryo deals its damage and makes no copy', {
    party: BANNER,
    setup: { hand: ['virelle.strike'] },
    play: [{ card: 'virelle.strike', target: 0 }],
    expect: { enemyHp: [600 - 36], resources: { embryo: 0 }, mana: 5 },
    check: ({ state }) => {
      expect(marks(state)).toEqual([[]]);
      expect(state.piles.hand).toEqual([]);
    },
  });

  scenario('An unplayed Strike copy goes to the Graveyard at the end of the turn', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['virelle.strike'], resources: { embryo: 1 } },
    play: [{ card: 'virelle.strike', target: 0 }, { endTurn: true }],
    check: ({ state }) => {
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['virelle.strike']);
      expect(state.piles.hand.filter((c) => c.cost === 0)).toEqual([]);
    },
  });

  scenario('Suture Cut deals 150% of Attack and applies 150% of it in Bleed (27 and 27); Opened Vein gains 1 Embryo', {
    party: BANNER,
    setup: { hand: ['virelle.suture-cut'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }],
    expect: { enemyHp: [600 - 27], resources: { embryo: 1 }, mana: 4 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 27]]]);
      previewMatchesResult(plays[0] as ScenarioPlay);
    },
  });

  scenario('Opened Vein pays only the first Bleed of the turn, and again the next turn', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['virelle.suture-cut', 'virelle.bloodletting'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { card: 'virelle.bloodletting', target: 0 }],
    expect: { resources: { embryo: 1 } },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 27 + 36]]]),
  });

  scenario("Opened Vein counts any member's Bleed, Grafting Knife's too", {
    party: ['maelia', 'virelle', 'agathe', 'leonora'],
    setup: { hand: [{ card: 'flesh.grafting-knife', owner: 'maelia' }] },
    play: [{ card: 'flesh.grafting-knife', target: 0 }],
    expect: { resources: { embryo: 1 } },
  });

  scenario('Open the Wound with 2 Embryo: the enemy loses twice its Bleed, and the Bleed stays', {
    party: BANNER,
    setup: { hand: ['virelle.suture-cut', 'virelle.open-the-wound'], resources: { embryo: 2 } },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { card: 'virelle.open-the-wound', target: 0 }],
    // Suture Cut 27, Open the Wound 30 (167%), then 2 × 27 Bleed.
    expect: { enemyHp: [600 - 27 - 30 - 54], resources: { embryo: 2 + 1 - 2 }, mana: 2 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 27]]]);
      previewMatchesResult(plays[1] as ScenarioPlay);
    },
  });

  scenario('Open the Wound without 2 Embryo deals its damage and spends nothing', {
    party: BANNER,
    setup: { hand: ['virelle.open-the-wound'], resources: { embryo: 1 } },
    play: [{ card: 'virelle.open-the-wound', target: 0 }],
    expect: { enemyHp: [600 - 30], resources: { embryo: 1 } },
  });

  scenario('Thorn-Spur Bloom: 150% of her Attack in Bleed on every enemy, 2 Embryo and 1 from Opened Vein, and Transcend', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['virelle.thorn-spur-bloom'] },
    play: [{ card: 'virelle.thorn-spur-bloom' }],
    expect: { resources: { embryo: 3 }, gauges: { virelle: 35 }, mana: 3 },
    check: ({ state }) => {
      expect(marks(state)).toEqual([[['bleed', 27]], [['bleed', 27]]]);
      expect(transcended(state, 'virelle')).toBe(true);
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['virelle.thorn-spur-bloom']);
    },
  });

  scenario('Thousand Cuts hits every enemy 5 times for 150% of Attack, each hit 17% of it in Bleed (27 and 3); preview equals result', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: [], gauges: { virelle: 100 } },
    play: [{ ultimate: 'virelle' }],
    expect: { enemyHp: [600 - 135, 600 - 135], resources: { embryo: 1 }, gauges: { virelle: 0 }, mana: 6 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 15]], [['bleed', 15]]]);
      expect(plays[0]?.preview[0]).toMatchObject({ op: 'repeat', amount: 5 });
      previewMatchesResult(plays[0] as ScenarioPlay);
    },
  });

  scenario('Thousand Cuts, Transcended, hits 7 times', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['virelle.thorn-spur-bloom'], gauges: { virelle: 65 } },
    play: [{ card: 'virelle.thorn-spur-bloom' }, { ultimate: 'virelle' }],
    expect: { enemyHp: [9999 - 7 * 27] },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 27 + 7 * 3]]]),
  });

  scenario('Bloodletting applies 200% of her Attack in Bleed', {
    party: BANNER,
    setup: { hand: ['virelle.bloodletting'] },
    play: [{ card: 'virelle.bloodletting', target: 0 }],
    expect: { mana: 5, resources: { embryo: 1 } },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 36]]]),
  });

  scenario('Thorn Spur deals 150% of Attack twice', {
    party: BANNER,
    setup: { hand: ['virelle.thorn-spur'] },
    play: [{ card: 'virelle.thorn-spur', target: 0 }],
    expect: { enemyHp: [600 - 54], mana: 5 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });
});

describe('Isadora', () => {
  scenario('Ankle Bells: 2 Tentacles and +20% of her Attack per hit', {
    party: BANNER,
    setup: { hand: ['isadora.ankle-bells'] },
    play: [{ card: 'isadora.ankle-bells' }],
    expect: { resources: { tentacles: 2, potency: 15 }, mana: 4 },
  });

  scenario('Ecstatic Spin volleys twice; Rapt adds +20% of her Attack per hit after', {
    party: BANNER,
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 3 } },
    play: [{ card: 'isadora.ecstatic-spin' }],
    expect: { enemyHp: [600 - 2 * 3 * 12], resources: { tentacles: 3, potency: 15 }, mana: 2 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  scenario('Rapt pays once a turn, and not for the end-of-turn attack', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.ribbon-lash', 'isadora.ecstatic-spin'], resources: { tentacles: 2 } },
    play: [{ card: 'isadora.ribbon-lash', target: 0 }, { card: 'isadora.ecstatic-spin' }, { endTurn: true }],
    expect: { resources: { potency: 15 } },
  });

  scenario('Rapt counts any member\'s card volley, Censer Rite\'s too', {
    party: ['agathe', 'isadora', 'maelia', 'leonora'],
    setup: { hand: ['agathe.censer-rite'] },
    play: [{ card: 'agathe.censer-rite' }],
    // A start of 80% of the party's average Attack (12.75), then 50% of Agathe's 12, then Rapt's 20% of Isadora's 15.
    check: ({ state }) => expect(state.resources['potency']).toBeCloseTo(10.2 + 6 + 3),
  });

  scenario('The Veil Torn: 3 Tentacles, a volley, and Transcend', {
    party: BANNER,
    setup: { hand: ['isadora.the-veil-torn'] },
    play: [{ card: 'isadora.the-veil-torn' }],
    expect: { enemyHp: [600 - 3 * 12], resources: { tentacles: 3, potency: 15 }, gauges: { isadora: 35 }, mana: 2 },
    check: ({ state }) => expect(transcended(state, 'isadora')).toBe(true),
  });

  scenario('Dance of Bells: every volley this turn hits twice, the end-of-turn attack included, then it ends', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 2 }, gauges: { isadora: 100 } },
    play: [{ ultimate: 'isadora' }, { card: 'isadora.ecstatic-spin' }, { endTurn: true }],
    // Spin: 2 volleys × 2 passes × 2 hits × 12. End of turn: 2 passes × 2 hits × 15 (after Rapt).
    expect: { enemyHp: [9999 - 96 - 60] },
    check: ({ state, plays }) => {
      expect(plays[1]?.after.party.statuses.map((s) => s.status)).toEqual(['status.dance-of-bells']);
      expect(state.party.statuses).toEqual([]);
      previewMatchesResult(plays[1] as ScenarioPlay);
    },
  });

  scenario('Dance of Bells: the second pass picks its targets from the HP the first left', {
    party: BANNER,
    enemies: [BIG, 'enemy.bloom-rib-whelp'],
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 3, potency: 10 }, gauges: { isadora: 100 } },
    play: [{ ultimate: 'isadora' }, { card: 'isadora.ecstatic-spin' }],
    // Twelve hits of 10 over two volleys of two passes: the 95-HP Whelp takes the first ten, the tenth
    // emptying it with 5 to spare for the big dummy, and every later hit goes to the big dummy.
    expect: { enemyHp: [9999 - (12 * 10 - 95), 0] },
  });

  scenario('Dance of Bells, Transcended, also volleys at once, twice over', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.the-veil-torn'], gauges: { isadora: 65 } },
    play: [{ card: 'isadora.the-veil-torn' }, { ultimate: 'isadora' }],
    // Veil Torn: 3 hits of 12. Then 2 passes of 3 hits of 15 (after Rapt).
    expect: { enemyHp: [9999 - 36 - 90] },
  });

  scenario('Petal Ribbon: +20% of her Attack per hit, draw 1', {
    party: BANNER,
    setup: { hand: ['isadora.petal-ribbon'] },
    play: [{ card: 'isadora.petal-ribbon' }],
    expect: { resources: { potency: 15 }, handSize: 1, mana: 5 },
  });

  scenario('Ribbon Lash: 160% of Attack, then a volley', {
    party: BANNER,
    setup: { hand: ['isadora.ribbon-lash'], resources: { tentacles: 2 } },
    play: [{ card: 'isadora.ribbon-lash', target: 0 }],
    // 160% of 15, then 2 hits of 12.
    expect: { enemyHp: [600 - 24 - 24], mana: 4 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });
});

describe('Kibane', () => {
  scenario('Foxfire Rite deals 80% of Attack plus 200% per Essence (12 + 30 × Essence), and a Ritual played charges Kibane by 10', {
    party: BANNER,
    setup: { hand: ['kibane.foxfire-rite'], resources: { essence: 4 } },
    play: [{ card: 'kibane.foxfire-rite', target: 0 }],
    expect: { enemyHp: [600 - 132], gauges: { kibane: 10 }, mana: 1 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  scenario("Foxfire charges Kibane for anyone's Ritual", {
    party: ['kibane', 'anthe', 'maelia', 'agathe'],
    setup: { hand: ['anthe.votive-candle'] },
    play: [{ card: 'anthe.votive-candle', target: 0 }],
    expect: { gauges: { kibane: 10, anthe: 0 } },
  });

  scenario('Foxfire: 2 Essence per Ritual held at end of turn; with Anthe, 4', {
    party: ['kibane', 'anthe', 'hester', 'virelle'],
    enemies: [BIG],
    setup: { hand: ['kibane.foxfire-rite', 'anthe.votive-candle'] },
    play: [{ endTurn: true }],
    expect: { resources: { essence: 8 } },
  });

  scenario('Shrine Bell: 2 Essence, 3 while holding a Ritual', {
    party: BANNER,
    setup: { hand: ['kibane.shrine-bell', 'kibane.foxfire-rite'] },
    play: [{ card: 'kibane.shrine-bell' }],
    expect: { resources: { essence: 3 }, mana: 4 },
  });

  scenario('Shrine Bell without a Ritual in hand gains 2', {
    party: BANNER,
    setup: { hand: ['kibane.shrine-bell'] },
    play: [{ card: 'kibane.shrine-bell' }],
    expect: { resources: { essence: 2 } },
  });

  scenario('The Ninth Tail: 3 Essence, a Foxfire Wisp in hand, and Transcend; the Wisp deals 120% of her Attack per Essence and exhausts', {
    party: BANNER,
    setup: { hand: ['kibane.the-ninth-tail'], mana: 7 },
    play: [{ card: 'kibane.the-ninth-tail' }, { card: 'kibane.foxfire-wisp', target: 0 }],
    expect: { enemyHp: [600 - 54], resources: { essence: 3 }, gauges: { kibane: 35 + 10 }, mana: 0 },
    check: ({ state, plays }) => {
      expect(plays[0]?.after.piles.hand.map((c) => c.card)).toEqual(['kibane.foxfire-wisp']);
      expect(transcended(state, 'kibane')).toBe(true);
      expect(state.piles.graveyard.map((c) => c.card).sort()).toEqual(['kibane.foxfire-wisp', 'kibane.the-ninth-tail']);
    },
  });

  scenario("Kyubi's Judgement consumes all Essence: 200% of her Attack plus 160% per Essence to every enemy", {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: [], resources: { essence: 5 }, gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    // 30 + 24 × 5.
    expect: { enemyHp: [600 - 150, 600 - 150], resources: { essence: 0 } },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  scenario("Kyubi's Judgement with no Essence still deals 200% of her Attack", {
    party: BANNER,
    setup: { hand: [], gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    expect: { enemyHp: [600 - 30] },
  });

  scenario("Kyubi's Judgement, Transcended: 240% of her Attack per Essence", {
    party: BANNER,
    enemies: [BIG, BIG],
    setup: { hand: ['kibane.the-ninth-tail'], resources: { essence: 2 }, gauges: { kibane: 65 } },
    play: [{ card: 'kibane.the-ninth-tail' }, { ultimate: 'kibane' }],
    // 30 + 36 × 5.
    expect: { enemyHp: [9999 - 210, 9999 - 210], resources: { essence: 0 } },
  });

  scenario('Fox Lantern: 1 Essence, draw 1', {
    party: BANNER,
    setup: { hand: ['kibane.fox-lantern'] },
    play: [{ card: 'kibane.fox-lantern' }],
    expect: { resources: { essence: 1 }, handSize: 1, mana: 5 },
  });

  scenario('Gauntlet Rake: 200% of Attack, 1 Essence', {
    party: BANNER,
    setup: { hand: ['kibane.gauntlet-rake'] },
    play: [{ card: 'kibane.gauntlet-rake', target: 0 }],
    expect: { enemyHp: [600 - 30], resources: { essence: 1 }, mana: 4 },
  });
});

describe('Hester', () => {
  scenario("Weighted Net: Delay and 1 Weak; the skipped action gives Hunter's Patience 2 Vulnerable", {
    party: BANNER,
    enemies: [HOUND],
    setup: { hand: ['hester.weighted-net'] },
    play: [{ card: 'hester.weighted-net', target: 0 }, { endTurn: true }],
    expect: { partyHp: 200 },
    check: ({ state, plays }) => {
      expect(marks(plays[0]!.after)).toEqual([[['delay', 1], ['weak', 1]]]);
      // Delay keeps the Bite shown; Weak ran out with the Hound's turn.
      expect(marks(state)).toEqual([[['vulnerable', 2]]]);
      expect(state.enemies[0]?.intent).toBe(0);
    },
  });

  scenario("On an elite, Delay lands as Falter, and Hunter's Patience pays when it Falters", {
    party: BANNER,
    enemies: [ELITE],
    setup: { hand: ['hester.weighted-net'] },
    play: [{ card: 'hester.weighted-net', target: 0 }, { endTurn: true }],
    check: ({ state, plays }) => {
      expect(marks(plays[0]!.after)).toEqual([[['falter', 1], ['weak', 1]]]);
      expect(marks(state)[0]).toEqual([['vulnerable', 2]]);
    },
  });

  scenario('Vulnerable from a skipped action holds for the next two of your turns', {
    party: BANNER,
    enemies: [HOUND],
    setup: { hand: ['hester.weighted-net'] },
    play: [{ card: 'hester.weighted-net', target: 0 }, { endTurn: true }, { endTurn: true }],
    check: ({ state }) => expect(marks(state)[0]).toEqual([['vulnerable', 1]]),
  });

  scenario('Bone Whistle: 1 Weak and 1 Vulnerable on every enemy, draw 1', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['hester.bone-whistle'] },
    play: [{ card: 'hester.bone-whistle' }],
    expect: { handSize: 1, mana: 4 },
    check: ({ state }) => expect(marks(state)).toEqual([[['weak', 1], ['vulnerable', 1]], [['weak', 1], ['vulnerable', 1]]]),
  });

  scenario('Iron Hooks: 2 Vulnerable on every enemy, and Transcend', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['hester.iron-hooks'] },
    play: [{ card: 'hester.iron-hooks' }],
    expect: { gauges: { hester: 35 }, mana: 3 },
    check: ({ state }) => {
      expect(marks(state)).toEqual([[['vulnerable', 2]], [['vulnerable', 2]]]);
      expect(transcended(state, 'hester')).toBe(true);
    },
  });

  scenario('The Snare Closes Stuns every enemy: each loses its shown action and reveals the next, and gains 2 Vulnerable', {
    party: BANNER,
    enemies: [HOUND, HOUND],
    setup: { hand: [], gauges: { hester: 100 } },
    play: [{ ultimate: 'hester' }, { endTurn: true }],
    expect: { partyHp: 200 },
    check: ({ state, plays }) => {
      expect(marks(plays[0]!.after)).toEqual([[['stun', 1]], [['stun', 1]]]);
      expect(state.enemies.map((e) => e.intent)).toEqual([1, 1]);
      expect(marks(state)).toEqual([[['vulnerable', 2]], [['vulnerable', 2]]]);
    },
  });

  scenario('The Snare Closes, Transcended, also applies 2 Weak to every enemy', {
    party: BANNER,
    enemies: [HOUND, HOUND],
    setup: { hand: ['hester.iron-hooks'], gauges: { hester: 65 } },
    play: [{ card: 'hester.iron-hooks' }, { ultimate: 'hester' }],
    check: ({ state }) => expect(marks(state)).toEqual([
      [['vulnerable', 2], ['stun', 1], ['weak', 2]],
      [['vulnerable', 2], ['stun', 1], ['weak', 2]],
    ]),
  });

  scenario('Pitfall applies 2 Vulnerable, and the next hit lands 50% harder', {
    party: BANNER,
    setup: { hand: ['hester.pitfall', 'virelle.strike'] },
    play: [{ card: 'hester.pitfall', target: 0 }, { card: 'virelle.strike', target: 0 }],
    // Virelle's 36 × 1.5.
    expect: { enemyHp: [600 - 54], mana: 4 },
    check: ({ plays }) => expect(marks(plays[0]!.after)).toEqual([[['vulnerable', 2]]]),
  });

  scenario('Tangle Line: 200% of Defense in Shield, 1 Weak on every enemy', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['hester.tangle-line'] },
    play: [{ card: 'hester.tangle-line' }],
    expect: { partyShield: 24, mana: 5 },
    check: ({ state }) => expect(marks(state)).toEqual([[['weak', 1]], [['weak', 1]]]),
  });
});
