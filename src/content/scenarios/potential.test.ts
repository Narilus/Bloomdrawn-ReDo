import { describe, expect } from 'vitest';
import { cardCost, describeKit, type CombatState } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario } from '../testing/scenario.ts';

// The starters' Potential levels (owner, 15 Nov: the lighter set for Agathe, Maelia and Anthe, and
// Leonora's draft; docs/notes/starter-kits.md, "Potential"), one scenario or more per level. A level
// holds every level below it. The starter party: Maelia (Attack 9, Defense 15), Agathe (12, 12),
// Anthe (9, 15) and Leonora (15, 9), 210 HP at P0, against 600-HP training dummies; P2 adds +3 Attack
// and +3 Defense. Mana starts at 6. Rapture's damage per hit is 80% of the party's average Attack:
// 9 at P0, 9.6 with Agathe at P2 (dealt as 9).
const DUMMY = 'enemy.training-dummy';

const marks = (state: CombatState) => state.enemies.map((e) => e.statuses.map((s) => [s.status.replace('status.', ''), s.stacks]));
const manaSpent = (play: { before: CombatState; after: CombatState }) => play.before.mana - play.after.mana;
const costInHand = (state: CombatState, card: string) => {
  const held = state.piles.hand.find((c) => c.card === card);
  return held && cardCost(state, held, registry);
};

describe('Agathe', () => {
  scenario('P1: First Hymn also gives Shield equal to twice her Defense on the first turn only', {
    dupes: { agathe: 1 },
    setup: { hand: [] },
    play: [{ endTurn: true }],
    // 2 × Defense 12; the next turn starts without it.
    expect: { partyShield: 0 },
    check: ({ state, plays }) => {
      expect(plays[0]!.before.party.shield).toBe(24);
      expect(plays[0]!.before.resources['tentacles']).toBe(1);
      expect(describeKit(state, 'm1', registry).passive).toBe('At combat start, gain 1 Tentacle. On the first turn, gain 24 Shield.');
    },
  });

  scenario('P3: Call the Choir always draws its card, below 4 Tentacles too', {
    dupes: { agathe: 3 },
    setup: { hand: ['agathe.call-the-choir-c3'] },
    play: [{ card: 'agathe.call-the-choir-c3' }],
    // First Hymn's 1 and the card's 2.
    expect: { resources: { tentacles: 3 }, handSize: 1 },
  });

  scenario('P4: Hymn of the Hundred Arms gains 3 Tentacles, then triggers a volley', {
    dupes: { agathe: 4 },
    setup: { hand: [], gauges: { agathe: 100 }, resources: { tentacles: 1 } },
    play: [{ ultimate: 'agathe' }],
    expect: { resources: { tentacles: 4 }, enemyHp: [600 - 4 * 9], gauges: { agathe: 0 } },
  });

  scenario('P5: her Strike triggers a volley with 4 or more Tentacles', {
    dupes: { agathe: 5 },
    setup: { hand: ['agathe.strike-c5'], resources: { tentacles: 4 } },
    play: [{ card: 'agathe.strike-c5', target: 0 }],
    // 250% of Attack 15, then 4 hits of 9.
    expect: { enemyHp: [600 - 37 - 4 * 9] },
  });

  scenario('P5: with 3 Tentacles, her Strike only deals its damage', {
    dupes: { agathe: 5 },
    setup: { hand: ['agathe.strike-c5'], resources: { tentacles: 3 } },
    play: [{ card: 'agathe.strike-c5', target: 0 }],
    expect: { enemyHp: [600 - 37] },
  });
});

describe('Maelia', () => {
  scenario("P1: Midwife's Hands gives 1 more Embryo and Shield equal to her Defense, once a turn", {
    dupes: { maelia: 1 },
    setup: { hand: ['maelia.swollen-pod', 'maelia.ripened-womb'] },
    play: [{ card: 'maelia.swollen-pod' }, { card: 'maelia.ripened-womb' }],
    // Swollen Pod 3 (+1), Ripened Womb 3; Shield 15 once.
    expect: { resources: { embryo: 3 + 1 + 3 }, partyShield: 15 },
    check: ({ state }) =>
      expect(describeKit(state, 'm0', registry).passive).toBe('The first time each turn a card gains Embryo, gain 1 more and 15 Shield.'),
  });

  scenario('P3: Bud Cutting costs 2', {
    dupes: { maelia: 3 },
    setup: { hand: ['maelia.bud-cutting-c3'] },
    play: [{ card: 'maelia.bud-cutting-c3' }],
    check: ({ plays }) => expect(manaSpent(plays[0]!)).toBe(2),
  });

  scenario('P4: Birthing Bloom heals and Shields half as much again for each Embryo', {
    dupes: { maelia: 4 },
    setup: { hand: [], gauges: { maelia: 100 }, resources: { embryo: 4 }, partyHp: 100 },
    play: [{ ultimate: 'maelia' }],
    // P2's max HP 216 (Maelia 61): 2.145% of it is 4.63 an Embryo, 18 for four. Shield 1.2 × Defense 18 an Embryo, 86 for four.
    expect: { resources: { embryo: 0 }, partyHp: 118, partyShield: 86 },
  });

  scenario('P5: Embryo consumed, by anyone, gives every enemy 34% of her Attack in Poison for each', {
    dupes: { maelia: 5 },
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.strike'], resources: { embryo: 1 } },
    play: [{ card: 'maelia.strike', target: 0 }],
    // Attack 12 at P2: Strike's own Poison is 134% (16), and 34% (4) on both dummies for the Embryo it spent.
    expect: { resources: { embryo: 0 } },
    check: ({ state }) => expect(marks(state)).toEqual([[['poison', 16 + 4]], [['poison', 4]]]),
  });

  scenario('P5: Birthing Bloom consuming 4 Embryo gives every enemy 4 × 34% of her Attack in Poison', {
    dupes: { maelia: 5 },
    setup: { hand: [], gauges: { maelia: 100 }, resources: { embryo: 4 } },
    play: [{ ultimate: 'maelia' }],
    check: ({ state }) => expect(marks(state)).toEqual([[['poison', 16]]]),
  });
});

describe('Anthe', () => {
  scenario('P1: Vigil also gives Shield equal to her Defense for each Ritual in hand', {
    dupes: { anthe: 1 },
    setup: { hand: ['anthe.votive-candle', 'anthe.long-vigil'] },
    play: [{ endTurn: true }],
    expect: { resources: { essence: 4 } },
    check: ({ plays }) => {
      const shield = plays[0]!.events.filter((e) => e.type === 'shieldGained').map((e) => e.amount);
      expect(shield).toEqual([30]);
    },
  });

  scenario('P3: Votive Candle costs 4', {
    dupes: { anthe: 3 },
    setup: { hand: ['anthe.votive-candle-c3'] },
    play: [{ card: 'anthe.votive-candle-c3', target: 0 }],
    check: ({ plays }) => expect(manaSpent(plays[0]!)).toBe(4),
  });

  scenario('P4: Hours Kept also draws 1 card', {
    dupes: { anthe: 4 },
    setup: { hand: ['anthe.votive-candle-c3'], held: { 'anthe.votive-candle-c3': 2 }, gauges: { anthe: 100 } },
    play: [{ ultimate: 'anthe' }],
    expect: { resources: { essence: 2 }, handSize: 2 },
  });

  scenario('P5: a held Ritual costs 2 less each turn, not 1', {
    dupes: { anthe: 5 },
    setup: { hand: ['anthe.votive-candle-c3'] },
    play: [{ endTurn: true }],
    check: ({ state }) => {
      expect(costInHand(state, 'anthe.votive-candle-c3')).toBe(4 - 2);
      expect(describeKit(state, 'm2', registry).passive).toMatch(/Held Rituals cost 2 less each turn, not 1\.$/);
    },
  });

  scenario('P4, for comparison: 1 less', {
    dupes: { anthe: 4 },
    setup: { hand: ['anthe.votive-candle-c3'] },
    play: [{ endTurn: true }],
    check: ({ state }) => expect(costInHand(state, 'anthe.votive-candle-c3')).toBe(4 - 1),
  });
});

describe('Leonora', () => {
  scenario('P1: Running Tab draws 2', {
    dupes: { leonora: 1 },
    setup: { hand: ['leonora.promissory-note'] },
    play: [{ card: 'leonora.promissory-note' }, { endTurn: true }],
    // The usual 5, and 2 more for the debt.
    expect: { handSize: 7 },
  });

  scenario('P3: Promissory Note gains 5 Mana, and the debt is still 2', {
    dupes: { leonora: 3 },
    setup: { hand: ['leonora.promissory-note-c3'] },
    play: [{ card: 'leonora.promissory-note-c3' }, { endTurn: true }],
    expect: { mana: 4 },
    check: ({ plays }) => expect(plays[0]!.after.mana).toBe(6 - 2 + 5),
  });

  scenario('P4: Balance the Books also draws 2 cards', {
    dupes: { leonora: 4 },
    setup: { hand: ['leonora.strike'], gauges: { leonora: 100 } },
    play: [{ card: 'leonora.strike', target: 0 }, { ultimate: 'leonora' }],
    expect: { mana: 6, handSize: 2 },
  });

  scenario('P4: Transcended, it draws 4', {
    dupes: { leonora: 4 },
    setup: { hand: ['leonora.call-in-the-debts'], gauges: { leonora: 65 } },
    play: [{ card: 'leonora.call-in-the-debts' }, { ultimate: 'leonora' }],
    // Call in the Debts draws 2 and charges 35; the ultimate draws 4.
    expect: { handSize: 6 },
  });

  scenario('P5: a turn that starts in debt makes the next card cost 1 less', {
    dupes: { leonora: 5 },
    setup: { hand: ['leonora.promissory-note-c3'] },
    play: [{ card: 'leonora.promissory-note-c3' }, { endTurn: true }],
    check: ({ state }) => {
      // Any card drawn that costs something shows 1 less.
      const card = state.piles.hand.find((c) => registry.cards[c.card]!.cost > 0)!;
      expect(cardCost(state, card, registry)).toBe(registry.cards[card.card]!.cost - 1);
    },
  });
});
