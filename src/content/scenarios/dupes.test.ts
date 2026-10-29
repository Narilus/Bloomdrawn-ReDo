import { describe, expect } from 'vitest';
import { describeCardLive, describeKit, type CombatState } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario } from '../testing/scenario.ts';

// The banner four's dupe levels (docs/notes/banner-kits.md, reviewed by the owner 25 Oct), one
// scenario or more per level. A level holds every level below it, so each scenario sets the one it
// tests and leans on the rest only where it says so. The party is one per Domain: Virelle (Attack 6,
// Defense 2), Isadora (5, 3), Kibane (5, 3) and Hester (4, 4), 200 HP at C0. Mana starts at 6.
const BANNER = ['virelle', 'isadora', 'kibane', 'hester'];
const DUMMY = 'enemy.training-dummy';
const BIG = 'enemy.practice-dummy';
const BIG_HP = 9999;
const HOUND = 'enemy.bloom-rib-hound';

/** Each enemy's statuses as [name, stacks]. */
const marks = (state: CombatState) => state.enemies.map((e) => e.statuses.map((s) => [s.status.replace('status.', ''), s.stacks]));
const manaSpent = (play: { before: CombatState; after: CombatState }) => play.before.mana - play.after.mana;

describe('C2: +10% HP, rounded, and +1 Attack and +1 Defense, for everyone', () => {
  const HP: Record<string, number> = { virelle: 45, isadora: 50, kibane: 50, hester: 55 };
  const SHIELD: Record<string, number> = { virelle: 7, isadora: 8, kibane: 8, hester: 9 };
  const STRIKE: Record<string, number> = { virelle: 12, isadora: 11, kibane: 11, hester: 10 };
  for (const who of BANNER) {
    scenario(`${who} at C2: Strike deals 1 more, Defense gives 1 more Shield, and the party has her extra HP`, {
      party: BANNER,
      dupes: { [who]: 2 },
      setup: { hand: [`${who}.strike`, `${who}.defense`] },
      play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
      expect: { enemyHp: [60 - STRIKE[who]! - 1], partyShield: SHIELD[who]! + 1, partyHp: 200 - HP[who]! + Math.round(HP[who]! * 1.1) },
      check: ({ state }) => expect(state.party.maxHp).toBe(200 - HP[who]! + Math.round(HP[who]! * 1.1)),
    });
  }
});

describe('Virelle', () => {
  scenario('C1: the first Bleed each turn gives 2 Embryo', {
    party: BANNER,
    dupes: { virelle: 1 },
    setup: { hand: ['virelle.suture-cut'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }],
    expect: { resources: { embryo: 2 } },
    check: ({ state }) => expect(describeKit(state, 'm0', registry).passive).toMatch(/^The first time each turn you apply Bleed, gain 2 Embryo\./),
  });

  scenario("C3: Open the Wound is dealt in its C3 form, and its detonation is three times the Bleed", {
    party: BANNER,
    dupes: { virelle: 3 },
    setup: { hand: ['virelle.suture-cut', 'virelle.open-the-wound-c3'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { card: 'virelle.open-the-wound-c3', target: 0 }],
    // With C2's Attack 7. Suture Cut: 10 damage and 9 Bleed, and C1's 2 Embryo. Open the Wound: 11 damage, then 3 × 9.
    expect: { enemyHp: [60 - 10 - 11 - 27], resources: { embryo: 0 } },
    check: ({ state }) => {
      const cards = [...state.piles.draw, ...state.piles.hand, ...state.piles.discard].map((c) => c.card);
      expect([cards.includes('virelle.open-the-wound'), cards.includes('virelle.open-the-wound-c3')]).toEqual([false, true]);
    },
  });

  scenario('C4: Thousand Cuts hits 7 times, each applying 1 Bleed', {
    party: BANNER,
    dupes: { virelle: 4 },
    enemies: [BIG],
    setup: { hand: [], gauges: { virelle: 100 } },
    play: [{ ultimate: 'virelle' }],
    // 3 + Attack 7 (C2) a hit.
    expect: { enemyHp: [BIG_HP - 7 * 10] },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 7]]]),
  });

  scenario('C4: Transcended, Thousand Cuts hits 9 times', {
    party: BANNER,
    dupes: { virelle: 4 },
    enemies: [BIG],
    setup: { hand: ['virelle.thorn-spur-bloom'], gauges: { virelle: 65 } },
    play: [{ card: 'virelle.thorn-spur-bloom' }, { ultimate: 'virelle' }],
    expect: { enemyHp: [BIG_HP - 9 * 10] },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 9 + 9]]]),
  });

  scenario('C5: Bleed on enemies deals its damage at end of turn and keeps every stack', {
    party: BANNER,
    dupes: { virelle: 5 },
    enemies: [BIG, BIG],
    setup: { hand: ['virelle.suture-cut', 'virelle.thorn-spur-bloom'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { card: 'virelle.thorn-spur-bloom' }, { endTurn: true }, { endTurn: true }],
    // Suture Cut 10 damage (Attack 7, C2); Bleed 18 and 9 tick twice each, staying put.
    expect: { enemyHp: [BIG_HP - 10 - 18 - 18, BIG_HP - 9 - 9] },
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 18]], [['bleed', 9]]]),
  });

  scenario('C4, for comparison: Bleed still loses a stack each tick', {
    party: BANNER,
    dupes: { virelle: 4 },
    enemies: [BIG],
    setup: { hand: ['virelle.suture-cut'] },
    play: [{ card: 'virelle.suture-cut', target: 0 }, { endTurn: true }],
    check: ({ state }) => expect(marks(state)).toEqual([[['bleed', 8]]]),
  });
});

describe('Isadora', () => {
  scenario("C1: Rapt gives +2 damage per hit for the turn's first volley from a card", {
    party: BANNER,
    dupes: { isadora: 1 },
    setup: { hand: ['isadora.ecstatic-spin'], resources: { tentacles: 1 } },
    play: [{ card: 'isadora.ecstatic-spin' }],
    // Damage per hit starts at 3, and Rapt answers once the card has resolved, as at C0.
    expect: { resources: { potency: 5 }, enemyHp: [60 - 3 - 3] },
  });

  scenario('C3: Ecstatic Spin costs 3', {
    party: BANNER,
    dupes: { isadora: 3 },
    setup: { hand: ['isadora.ecstatic-spin-c3'], resources: { tentacles: 1 } },
    play: [{ card: 'isadora.ecstatic-spin-c3' }],
    check: ({ plays }) => expect(manaSpent(plays[0]!)).toBe(3),
  });

  scenario('C4: Dance of Bells also gains 2 Tentacles, and they hit twice at end of turn', {
    party: BANNER,
    dupes: { isadora: 4 },
    setup: { hand: [], gauges: { isadora: 100 } },
    play: [{ ultimate: 'isadora' }, { endTurn: true }],
    expect: { resources: { tentacles: 2 }, enemyHp: [60 - 2 * 3 * 2] },
  });

  scenario('C4: Transcended, the 2 Tentacles come before its volley, which hits twice', {
    party: BANNER,
    dupes: { isadora: 4 },
    enemies: [BIG],
    setup: { hand: ['isadora.the-veil-torn'], gauges: { isadora: 65 } },
    play: [{ card: 'isadora.the-veil-torn' }, { ultimate: 'isadora' }],
    // The Veil Torn: 3 Tentacles and a volley (9, then Rapt makes it 5 a hit). The ultimate: 2 more, then 5 × 5 twice.
    expect: { resources: { tentacles: 5 }, enemyHp: [BIG_HP - 9 - 50] },
  });

  scenario('C5: at the end of each turn, Tentacles attack twice', {
    party: BANNER,
    dupes: { isadora: 5 },
    setup: { hand: [], resources: { tentacles: 2 } },
    play: [{ endTurn: true }],
    expect: { enemyHp: [60 - 2 * 3 * 2], resources: { potency: 3 } },
  });

  scenario('C4, for comparison: once', {
    party: BANNER,
    dupes: { isadora: 4 },
    setup: { hand: [], resources: { tentacles: 2 } },
    play: [{ endTurn: true }],
    expect: { enemyHp: [60 - 2 * 3] },
  });
});

describe('Kibane', () => {
  scenario('C1: playing a Ritual charges her ultimate by 15', {
    party: BANNER,
    dupes: { kibane: 1 },
    setup: { hand: ['kibane.foxfire-rite'] },
    play: [{ card: 'kibane.foxfire-rite', target: 0 }],
    expect: { gauges: { kibane: 15 } },
  });

  scenario('C3: Foxfire Rite deals 4 + 12 × Essence', {
    party: BANNER,
    dupes: { kibane: 3 },
    setup: { hand: ['kibane.foxfire-rite-c3'], resources: { essence: 3 } },
    play: [{ card: 'kibane.foxfire-rite-c3', target: 0 }],
    expect: { enemyHp: [60 - 40] },
    check: ({ plays }) => expect(describeCardLive(plays[0]!.before.piles.hand[0]!, plays[0]!.before, registry, { keywords: false })).toBe('Deal 40 damage.'),
  });

  scenario("C4: Kyubi's Judgement deals 10 + 10 × Essence consumed to every enemy", {
    party: BANNER,
    dupes: { kibane: 4 },
    enemies: [BIG, BIG],
    setup: { hand: [], resources: { essence: 5 }, gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    expect: { enemyHp: [BIG_HP - 60, BIG_HP - 60], resources: { essence: 0 } },
  });

  scenario("C4: Transcended, 10 + 14 × Essence consumed", {
    party: BANNER,
    dupes: { kibane: 4 },
    enemies: [BIG],
    setup: { hand: ['kibane.the-ninth-tail'], resources: { essence: 2 }, gauges: { kibane: 65 } },
    play: [{ card: 'kibane.the-ninth-tail' }, { ultimate: 'kibane' }],
    expect: { enemyHp: [BIG_HP - 10 - 14 * 5] },
  });

  scenario("C5: after Kyubi's Judgement, half the Essence consumed comes back, rounded down", {
    party: BANNER,
    dupes: { kibane: 5 },
    enemies: [BIG],
    setup: { hand: [], resources: { essence: 5 }, gauges: { kibane: 100 } },
    play: [{ ultimate: 'kibane' }],
    expect: { enemyHp: [BIG_HP - 60], resources: { essence: 2 } },
  });
});

describe('Hester', () => {
  scenario("C1: Hunter's Patience gives 3 Vulnerable", {
    party: BANNER,
    dupes: { hester: 1 },
    enemies: [HOUND],
    setup: { hand: ['hester.weighted-net'] },
    play: [{ card: 'hester.weighted-net', target: 0 }, { endTurn: true }],
    check: ({ state }) => expect(marks(state)).toEqual([[['vulnerable', 3]]]),
  });

  scenario('C3: Weighted Net costs 1', {
    party: BANNER,
    dupes: { hester: 3 },
    enemies: [HOUND],
    setup: { hand: ['hester.weighted-net-c3'] },
    play: [{ card: 'hester.weighted-net-c3', target: 0 }],
    check: ({ state, plays }) => {
      expect(manaSpent(plays[0]!)).toBe(1);
      expect(marks(state)).toEqual([[['delay', 1], ['weak', 1]]]);
    },
  });

  scenario('C4: The Snare Closes also applies 2 Vulnerable to every enemy', {
    party: BANNER,
    dupes: { hester: 4 },
    enemies: [HOUND, HOUND],
    setup: { hand: [], gauges: { hester: 100 } },
    play: [{ ultimate: 'hester' }],
    check: ({ state }) => expect(marks(state)).toEqual([[['stun', 1], ['vulnerable', 2]], [['stun', 1], ['vulnerable', 2]]]),
  });

  scenario('C4: Transcended, 2 Vulnerable and then 2 Weak', {
    party: BANNER,
    dupes: { hester: 4 },
    enemies: [HOUND],
    setup: { hand: ['hester.iron-hooks'], gauges: { hester: 65 } },
    play: [{ card: 'hester.iron-hooks' }, { ultimate: 'hester' }],
    check: ({ state }) => expect(marks(state)).toEqual([[['vulnerable', 4], ['stun', 1], ['weak', 2]]]),
  });

  scenario('C5: the Weak and Vulnerable she applies last a turn longer, her cards say so, and others are untouched', {
    party: BANNER,
    dupes: { hester: 5 },
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['hester.bone-whistle', 'hester.pitfall'] },
    play: [{ card: 'hester.bone-whistle' }, { card: 'hester.pitfall', target: 0 }],
    check: ({ state, plays }) => {
      expect(marks(state)).toEqual([[['weak', 2], ['vulnerable', 2 + 3]], [['weak', 2], ['vulnerable', 2]]]);
      const whistle = plays[0]!.before.piles.hand.find((c) => c.card === 'hester.bone-whistle')!;
      expect(describeCardLive(whistle, plays[0]!.before, registry, { charge: false })).toBe('Apply 2 Weak and 2 Vulnerable to all enemies. Draw 1 card.');
    },
  });

  scenario("C5: Hunter's Patience gives 4 Vulnerable, and Weighted Net's Weak outlasts the Hound's turn", {
    party: BANNER,
    dupes: { hester: 5 },
    enemies: [HOUND],
    setup: { hand: ['hester.weighted-net-c3'] },
    play: [{ card: 'hester.weighted-net-c3', target: 0 }, { endTurn: true }],
    check: ({ state }) => expect(marks(state)).toEqual([[['weak', 1], ['vulnerable', 4]]]),
  });
});
