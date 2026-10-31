import { describe, expect } from 'vitest';
import { describeCardLive, type CombatState } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario, type ScenarioPlay } from '../testing/scenario.ts';

// The banner four (docs/notes/banner-kits.md, reviewed by the owner 25 Oct), one scenario or more
// per card, passive, ultimate, Transcend and reward card. The party is one per Domain: Virelle
// (Attack 6, Defense 2), Isadora (5, 3), Kibane (5, 3) and Hester (4, 4). Nobody starts with a
// Tentacle, so the end-of-turn volley does nothing until Isadora makes some. Card numbers are ratios
// of the owner's stats (docs/notes/m6-scaling.md); damage per hit starts at 80% of the party's average
// Attack, 4 for these four, and each gain is a share of its card owner's Attack (Isadora's 20%: 1).
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
  const SHIELD: Record<string, number> = { virelle: 7, isadora: 8, kibane: 8, hester: 9 };
  const STRIKE: Record<string, number> = { virelle: 12, isadora: 11, kibane: 11, hester: 10 };
  for (const who of BANNER) {
    scenario(`${who}: Strike then Defense, preview equals result`, {
      party: BANNER,
      setup: { hand: [`${who}.strike`, `${who}.defense`] },
      play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
      expect: { enemyHp: [60 - (STRIKE[who] as number)], partyShield: SHIELD[who] as number, mana: 4, gauges: { [who]: 20 } },
      check: ({ plays }) => plays.forEach(previewMatchesResult),
    });
  }
});

describe('Virelle', () => {
  scenario('Strike chains while Embryo lasts: each costs 1 Embryo for 6 Bleed and a free Fleeting copy, 10% more per Strike before it', {
    party: BANNER,
    setup: { hand: ['virelle.strike'], resources: { embryo: 2 } },
    play: [
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
      { card: 'virelle.strike', target: 0 },
    ],
    // 12, then 12 × 1.1, × 1.2 and × 1.3, rounded down. Opened Vein gives back the first Embryo, so three
    // copies come; the last one finds no Embryo and makes none. Only the first Strike costs Mana, and every
    // one charges her ultimate.
    expect: { enemyHp: [60 - 12 - 13 - 14 - 15], resources: { embryo: 0 }, mana: 5, gauges: { virelle: 40 } },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 18]]]);
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
    expect: { enemyHp: [60 - 10 - 11 - 14] },
  });

  scenario("Strike's text in hand shows its damage as it grows with each Strike played", {
    party: BANNER,
    setup: { hand: ['hester.strike', 'kibane.strike', 'virelle.strike'] },
    play: [{ card: 'hester.strike', target: 0 }, { card: 'kibane.strike', target: 0 }],
    check: ({ state }) => {
      const strike = state.piles.hand.find((c) => c.card === 'virelle.strike')!;
      expect(describeCardLive(strike, state, registry, { charge: false })).toBe(
        'Deal 14 damage. Consume 1 Embryo: apply 6 Bleed and add a free Fleeting copy to your hand.',
      );
    },
  });

  scenario('Strike without Embryo deals its damage and makes no copy', {
    party: BANNER,
    setup: { hand: ['virelle.strike'] },
    play: [{ card: 'virelle.strike', target: 0 }],
    expect: { enemyHp: [60 - 12], resources: { embryo: 0 }, mana: 5 },
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

  scenario('Suture Cut deals 150% of Attack and applies 150% of it in Bleed (9 and 9); Opened Vein gains 1 Embryo', {
    party: BANNER,
    setup: { hand: ['virelle.suture-cut'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }],
    expect: { enemyHp: [60 - 9], resources: { embryo: 1 }, mana: 4 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 9]]]);
      previewMatchesResult(plays[0] as ScenarioPlay);
    },
  });

  scenario('Opened Vein pays only the first Bleed of the turn, and again the next turn', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['virelle.suture-cut', 'virelle.bloodletting'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { card: 'virelle.bloodletting', target: 0 }],
    expect: { resources: { embryo: 1 } },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 9 + 12]]]),
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
    // Suture Cut 9, Open the Wound 10, then 2 × 9 Bleed.
    expect: { enemyHp: [60 - 9 - 10 - 18], resources: { embryo: 2 + 1 - 2 }, mana: 2 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 9]]]);
      previewMatchesResult(plays[1] as ScenarioPlay);
    },
  });

  scenario('Open the Wound without 2 Embryo deals its damage and spends nothing', {
    party: BANNER,
    setup: { hand: ['virelle.open-the-wound'], resources: { embryo: 1 } },
    play: [{ card: 'virelle.open-the-wound', target: 0 }],
    expect: { enemyHp: [60 - 10], resources: { embryo: 1 } },
  });

  scenario('Thorn-Spur Bloom: 9 Bleed on every enemy, 2 Embryo and 1 from Opened Vein, and Transcend', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['virelle.thorn-spur-bloom'] },
    play: [{ card: 'virelle.thorn-spur-bloom' }],
    expect: { resources: { embryo: 3 }, gauges: { virelle: 35 }, mana: 3 },
    check: ({ state }) => {
      expect(marks(state)).toEqual([[['bleed', 9]], [['bleed', 9]]]);
      expect(transcended(state, 'virelle')).toBe(true);
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['virelle.thorn-spur-bloom']);
    },
  });

  scenario('Thousand Cuts hits every enemy 5 times for 150% of Attack, each hit 17% of it in Bleed (9 and 1); preview equals result', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: [], gauges: { virelle: 100 } },
    play: [{ ultimate: 'virelle' }],
    expect: { enemyHp: [60 - 45, 60 - 45], resources: { embryo: 1 }, gauges: { virelle: 0 }, mana: 6 },
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['bleed', 5]], [['bleed', 5]]]);
      expect(plays[0]?.preview[0]).toMatchObject({ op: 'repeat', amount: 5 });
      previewMatchesResult(plays[0] as ScenarioPlay);
    },
  });

  scenario('Thousand Cuts, Transcended, hits 7 times', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['virelle.thorn-spur-bloom'], gauges: { virelle: 65 } },
    play: [{ card: 'virelle.thorn-spur-bloom' }, { ultimate: 'virelle' }],
    expect: { enemyHp: [9999 - 7 * 9] },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 9 + 7]]]),
  });

  scenario('Bloodletting applies 12 Bleed', {
    party: BANNER,
    setup: { hand: ['virelle.bloodletting'] },
    play: [{ card: 'virelle.bloodletting', target: 0 }],
    expect: { mana: 5, resources: { embryo: 1 } },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 12]]]),
  });

  scenario('Thorn Spur deals 150% of Attack twice', {
    party: BANNER,
    setup: { hand: ['virelle.thorn-spur'] },
    play: [{ card: 'virelle.thorn-spur', target: 0 }],
    expect: { enemyHp: [60 - 18], mana: 5 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });
});

describe('Isadora', () => {
  scenario('Ankle Bells: 2 Tentacles and +1 damage per hit', {
    party: BANNER,
    setup: { hand: ['isadora.ankle-bells'] },
    play: [{ card: 'isadora.ankle-bells' }],
    expect: { resources: { tentacles: 2, potency: 5 }, mana: 4 },
  });

  scenario('Ecstatic Spin volleys twice; Rapt adds +1 per hit after', {
    party: BANNER,
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 3 } },
    play: [{ card: 'isadora.ecstatic-spin' }],
    expect: { enemyHp: [60 - 2 * 12], resources: { tentacles: 3, potency: 5 }, mana: 2 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  scenario('Rapt pays once a turn, and not for the end-of-turn attack', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.ribbon-lash', 'isadora.ecstatic-spin'], resources: { tentacles: 2 } },
    play: [{ card: 'isadora.ribbon-lash', target: 0 }, { card: 'isadora.ecstatic-spin' }, { endTurn: true }],
    expect: { resources: { potency: 5 } },
  });

  scenario('Rapt counts any member\'s card volley, Censer Rite\'s too', {
    party: ['agathe', 'isadora', 'maelia', 'leonora'],
    setup: { hand: ['agathe.censer-rite'] },
    play: [{ card: 'agathe.censer-rite' }],
    // A start of 80% of the party's average Attack (4.25), then 50% of Agathe's 4, then Rapt's 20% of Isadora's 5.
    expect: { resources: { potency: 3.4 + 2 + 1 } },
  });

  scenario('The Veil Torn: 3 Tentacles, a volley, and Transcend', {
    party: BANNER,
    setup: { hand: ['isadora.the-veil-torn'] },
    play: [{ card: 'isadora.the-veil-torn' }],
    expect: { enemyHp: [60 - 12], resources: { tentacles: 3, potency: 5 }, gauges: { isadora: 35 }, mana: 2 },
    check: ({ state }) => expect(transcended(state, 'isadora')).toBe(true),
  });

  scenario('Dance of Bells: every volley this turn hits twice, the end-of-turn attack included, then it ends', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 2 }, gauges: { isadora: 100 } },
    play: [{ ultimate: 'isadora' }, { card: 'isadora.ecstatic-spin' }, { endTurn: true }],
    // Spin: 2 volleys × 2 passes × 2 hits × 4. End of turn: 2 passes × 2 hits × 5 (after Rapt).
    expect: { enemyHp: [9999 - 32 - 20] },
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
    // First volley, pass one: five 10s empty the 50-HP Whelp, the sixth goes to the big dummy; every
    // later hit goes to the big dummy.
    expect: { enemyHp: [9999 - (6 * 2 * 10 - 50), 0] },
  });

  scenario('Dance of Bells, Transcended, also volleys at once, twice over', {
    party: BANNER,
    enemies: [BIG],
    setup: { hand: ['isadora.the-veil-torn'], gauges: { isadora: 65 } },
    play: [{ card: 'isadora.the-veil-torn' }, { ultimate: 'isadora' }],
    // Veil Torn: 3 hits of 4. Then 2 passes of 3 hits of 5 (after Rapt).
    expect: { enemyHp: [9999 - 12 - 30] },
  });

  scenario('Petal Ribbon: +1 damage per hit, draw 1', {
    party: BANNER,
    setup: { hand: ['isadora.petal-ribbon'] },
    play: [{ card: 'isadora.petal-ribbon' }],
    expect: { resources: { potency: 5 }, handSize: 1, mana: 5 },
  });

  scenario('Ribbon Lash: 160% of Attack, then a volley', {
    party: BANNER,
    setup: { hand: ['isadora.ribbon-lash'], resources: { tentacles: 2 } },
    play: [{ card: 'isadora.ribbon-lash', target: 0 }],
    expect: { enemyHp: [60 - 8 - 8], mana: 4 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });
});

describe('Kibane', () => {
  scenario('Foxfire Rite deals 80% of Attack plus 200% per Essence (4 + 10 × Essence), and a Ritual played charges Kibane by 10', {
    party: BANNER,
    setup: { hand: ['kibane.foxfire-rite'], resources: { essence: 4 } },
    play: [{ card: 'kibane.foxfire-rite', target: 0 }],
    expect: { enemyHp: [60 - 44], gauges: { kibane: 10 }, mana: 1 },
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

  scenario('The Ninth Tail: 3 Essence, a Foxfire Wisp in hand, and Transcend; the Wisp deals 6 × Essence and exhausts', {
    party: BANNER,
    setup: { hand: ['kibane.the-ninth-tail'], mana: 7 },
    play: [{ card: 'kibane.the-ninth-tail' }, { card: 'kibane.foxfire-wisp', target: 0 }],
    expect: { enemyHp: [60 - 18], resources: { essence: 3 }, gauges: { kibane: 35 + 10 }, mana: 0 },
    check: ({ state, plays }) => {
      expect(plays[0]?.after.piles.hand.map((c) => c.card)).toEqual(['kibane.foxfire-wisp']);
      expect(transcended(state, 'kibane')).toBe(true);
      expect(state.piles.graveyard.map((c) => c.card).sort()).toEqual(['kibane.foxfire-wisp', 'kibane.the-ninth-tail']);
    },
  });

  scenario("Kyubi's Judgement consumes all Essence: 10 + 8 per Essence to every enemy", {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: [], resources: { essence: 5 }, gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    expect: { enemyHp: [10, 10], resources: { essence: 0 } },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  scenario("Kyubi's Judgement with no Essence still deals 10", {
    party: BANNER,
    setup: { hand: [], gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    expect: { enemyHp: [50] },
  });

  scenario("Kyubi's Judgement, Transcended: 12 per Essence", {
    party: BANNER,
    enemies: [BIG, BIG],
    setup: { hand: ['kibane.the-ninth-tail'], resources: { essence: 2 }, gauges: { kibane: 65 } },
    play: [{ card: 'kibane.the-ninth-tail' }, { ultimate: 'kibane' }],
    expect: { enemyHp: [9999 - 70, 9999 - 70], resources: { essence: 0 } },
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
    expect: { enemyHp: [50], resources: { essence: 1 }, mana: 4 },
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
    expect: { enemyHp: [60 - 18], mana: 4 },
    check: ({ plays }) => expect(marks(plays[0]!.after)).toEqual([[['vulnerable', 2]]]),
  });

  scenario('Tangle Line: 200% of Defense in Shield, 1 Weak on every enemy', {
    party: BANNER,
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['hester.tangle-line'] },
    play: [{ card: 'hester.tangle-line' }],
    expect: { partyShield: 8, mana: 5 },
    check: ({ state }) => expect(marks(state)).toEqual([[['weak', 1]], [['weak', 1]]]),
  });
});
