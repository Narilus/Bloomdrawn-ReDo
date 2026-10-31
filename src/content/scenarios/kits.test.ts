import { describe, expect, it } from 'vitest';
import { apply, cardCost, startCombat } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { runScenario, scenario, STARTER_PARTY } from '../testing/scenario.ts';

// The approved starter kits (docs/notes/starter-kits.md), one scenario per card, passive and
// ultimate. The party is Maelia (Attack 9, Defense 15), Agathe (12, 12), Anthe (9, 15) and Leonora
// (15, 9), 210 HP, against a 600-HP training dummy. Tentacles start at 80% of the party's average
// Attack, 9 a hit, so Agathe's First Hymn Tentacle hits for 9 at every end of turn.
const DUMMY = 'enemy.training-dummy';

describe('Maelia', () => {
  scenario('Strike (300% of Attack) consumes 1 Embryo to apply 134% of her Attack in Poison', {
    setup: { hand: ['maelia.strike'], resources: { embryo: 2 } },
    play: [{ card: 'maelia.strike', target: 0 }],
    expect: { enemyHp: [600 - 27], resources: { embryo: 1 }, mana: 5 },
    check: ({ state }) => expect(state.enemies[0]?.statuses).toEqual([{ status: 'status.poison', stacks: 12 }]),
  });

  scenario('Strike without Embryo deals its damage and Poisons nothing', {
    setup: { hand: ['maelia.strike'] },
    play: [{ card: 'maelia.strike', target: 0 }],
    expect: { enemyHp: [600 - 27], resources: { embryo: 0 } },
    check: ({ state }) => expect(state.enemies[0]?.statuses).toEqual([]),
  });

  scenario("Swollen Pod gains 3 Embryo, 1 more from Midwife's Hands, and Poisons every enemy", {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.swollen-pod'] },
    play: [{ card: 'maelia.swollen-pod' }],
    expect: { resources: { embryo: 4 }, mana: 4 },
    check: ({ state }) => expect(state.enemies.map((e) => e.statuses)).toEqual([
      [{ status: 'status.poison', stacks: 24 }],
      [{ status: 'status.poison', stacks: 24 }],
    ]),
  });

  scenario("Midwife's Hands adds to the first Embryo gain of the turn only", {
    setup: { hand: ['maelia.swollen-pod', 'maelia.swollen-pod'] },
    play: [{ card: 'maelia.swollen-pod' }, { card: 'maelia.swollen-pod' }],
    expect: { resources: { embryo: 4 + 3 } },
  });

  scenario('Bud Cutting: the next card resolves twice but charges once, and 2 Embryo charges every gauge', {
    setup: { hand: ['maelia.bud-cutting', 'maelia.strike'], resources: { embryo: 2 } },
    play: [{ card: 'maelia.bud-cutting' }, { card: 'maelia.strike', target: 0 }],
    expect: { resources: { embryo: 0 }, enemyHp: [600 - 27 - 27], gauges: { maelia: 20, agathe: 10, anthe: 10, leonora: 10 } },
  });

  scenario('Bud Cutting without 2 Embryo spends and charges nothing, but still repeats', {
    setup: { hand: ['maelia.bud-cutting', 'maelia.swollen-pod'], resources: { embryo: 1 } },
    play: [{ card: 'maelia.bud-cutting' }, { card: 'maelia.swollen-pod' }],
    expect: { resources: { embryo: 1 + 4 + 3 }, gauges: { maelia: 0, agathe: 0, anthe: 0, leonora: 0 } },
    check: ({ state }) => expect(state.enemies[0]?.statuses).toEqual([{ status: 'status.poison', stacks: 48 }]),
  });

  // 1.43% of 210 max HP is 3.003 a heal, and 80% of Defense 15 is 12 Shield, per Embryo.
  scenario('Birthing Bloom consumes all Embryo: heal 3 and Shield 12 per Embryo, preview equal to result', {
    setup: { hand: [], gauges: { maelia: 100 }, resources: { embryo: 5 }, partyHp: 150 },
    play: [{ ultimate: 'maelia' }],
    expect: { resources: { embryo: 0 }, partyHp: 165, partyShield: 60, gauges: { maelia: 0 }, mana: 6 },
    check: ({ plays }) => {
      const branch = plays[0]?.preview[0]?.branch ?? [];
      expect(branch.map((p) => [p.op, p.amount])).toEqual([['heal', 15], ['gainShield', 60]]);
    },
  });
});

describe('Agathe', () => {
  scenario('First Hymn: the fight starts with a Tentacle', {
    play: [],
    expect: { resources: { tentacles: 1, potency: 9 } },
  });

  scenario('Call the Choir below 4 Tentacles draws nothing', {
    setup: { hand: ['agathe.call-the-choir'] },
    play: [{ card: 'agathe.call-the-choir' }],
    expect: { resources: { tentacles: 3 }, handSize: 0 },
  });

  scenario('Agathe draws at 4 Tentacles', {
    setup: { hand: ['agathe.call-the-choir'], resources: { tentacles: 2 } },
    play: [{ card: 'agathe.call-the-choir' }],
    expect: { resources: { tentacles: 4 }, handSize: 1 },
  });

  scenario('Censer Rite: +50% of her Attack per hit for the rest of combat, and a volley now', {
    setup: { hand: ['agathe.censer-rite'], resources: { tentacles: 2 } },
    play: [{ card: 'agathe.censer-rite' }, { endTurn: true }],
    // 9 + 6 a hit. Volley now: 2 × 15. End of turn: 2 × 15 again.
    expect: { resources: { potency: 15, tentacles: 2 }, enemyHp: [600 - 30 - 30] },
    check: ({ plays }) => expect(plays[0]?.preview.filter((p) => p.op === 'volley').map((p) => p.amount)).toEqual([15, 15]),
  });

  scenario('Hymn of the Hundred Arms gains 3 Tentacles', {
    setup: { hand: [], gauges: { agathe: 100 } },
    play: [{ ultimate: 'agathe' }],
    expect: { resources: { tentacles: 4 }, gauges: { agathe: 0 } },
  });
});

describe('Anthe', () => {
  scenario('Votive Candle deals 267% of Attack plus 200% per Essence (8 + 6 × Essence)', {
    setup: { hand: ['anthe.votive-candle'], resources: { essence: 4 } },
    play: [{ card: 'anthe.votive-candle', target: 0 }],
    // Attack 9 × (2.67 + 2 × 4).
    expect: { enemyHp: [600 - 96], mana: 1 },
  });

  scenario('Vigil: each Ritual held at end of turn gains 2 Essence, and the Ritual gets 1 cheaper', {
    setup: { hand: ['anthe.votive-candle'] },
    play: [{ endTurn: true }],
    expect: { resources: { essence: 2 } },
    check: ({ state }) => {
      const votive = state.piles.hand.find((c) => c.card === 'anthe.votive-candle');
      expect(votive && cardCost(state, votive, registry)).toBe(4);
    },
  });

  scenario('Gilded Thread: held Rituals cost 1 less, gain 1 Essence, draw 1', {
    setup: { hand: ['anthe.gilded-thread', 'anthe.votive-candle'] },
    play: [{ card: 'anthe.gilded-thread' }],
    expect: { resources: { essence: 1 }, handSize: 2, mana: 4 },
    check: ({ state }) => {
      const votive = state.piles.hand.find((c) => c.card === 'anthe.votive-candle');
      expect(votive && cardCost(state, votive, registry)).toBe(4);
    },
  });

  scenario('Hours Kept: 1 Essence per turn the held Rituals have been held', {
    setup: { hand: ['anthe.votive-candle'], gauges: { anthe: 100 } },
    play: [{ endTurn: true }, { endTurn: true }, { ultimate: 'anthe' }],
    // Vigil gave 2 each turn; Votive has been held 2 turns.
    expect: { resources: { essence: 4 + 2 }, gauges: { anthe: 0 } },
  });
});

describe('Leonora', () => {
  scenario('Promissory Note: Mana now, debt off the next refill, and Running Tab draws an extra card', {
    setup: { hand: ['leonora.promissory-note'] },
    play: [{ card: 'leonora.promissory-note' }, { endTurn: true }],
    expect: { mana: 4, handSize: 6 },
    check: ({ plays }) => expect(plays[0]?.after.mana).toBe(6 - 2 + 4),
  });

  scenario('Promissory Note after Bud Cutting gains its Mana and takes its debt twice', {
    setup: { hand: ['maelia.bud-cutting', 'leonora.promissory-note'] },
    play: [{ card: 'maelia.bud-cutting' }, { card: 'leonora.promissory-note' }, { endTurn: true }],
    expect: { mana: 6 - 2 - 2 },
    check: ({ plays }) => expect(plays[1]?.after.mana).toBe(6 - 3 - 2 + 4 + 4),
  });

  scenario('Requisition: draw 2, and the next card costs 2 less', {
    setup: { hand: ['leonora.requisition', 'leonora.strike'] },
    play: [{ card: 'leonora.requisition' }, { card: 'leonora.strike', target: 0 }],
    expect: { mana: 4, handSize: 2, enemyHp: [600 - 33] },
  });

  scenario('Balance the Books gains the Mana spent this turn', {
    setup: { hand: ['leonora.strike', 'leonora.promissory-note'], gauges: { leonora: 100 } },
    play: [{ card: 'leonora.strike', target: 0 }, { card: 'leonora.promissory-note' }, { ultimate: 'leonora' }],
    expect: { mana: 6 - 1 - 2 + 4 + 3, gauges: { leonora: 0 } },
  });
});

describe('Transcend', () => {
  scenario('Ripened Womb: 3 Embryo (+1 Midwife), a Seed Pod in hand, Transcended, 35 charge, then the Graveyard', {
    setup: { hand: ['maelia.ripened-womb'] },
    play: [{ card: 'maelia.ripened-womb' }, { card: 'maelia.seed-pod' }],
    expect: { resources: { embryo: 4 + 2 }, gauges: { maelia: 35 }, mana: 3 },
    check: ({ state }) => {
      expect(state.members.find((m) => m.character === 'maelia')?.transcended).toBe(true);
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['maelia.ripened-womb', 'maelia.seed-pod']);
    },
  });

  // 4 Embryo: heal 12, Shield 48, and 34% of Attack 9 in Poison each, 12.
  scenario('Transcended Birthing Bloom also Poisons every enemy for the Embryo consumed', {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.ripened-womb'], gauges: { maelia: 100 }, partyHp: 150 },
    play: [{ card: 'maelia.ripened-womb' }, { ultimate: 'maelia' }],
    expect: { resources: { embryo: 0 }, partyHp: 150 + 12, partyShield: 48 },
    check: ({ state }) => expect(state.enemies.map((e) => e.statuses)).toEqual([
      [{ status: 'status.poison', stacks: 12 }],
      [{ status: 'status.poison', stacks: 12 }],
    ]),
  });

  scenario('The Choir Answers: +2 Tentacles and +25% of her Attack per hit; the Transcended Hymn volleys', {
    setup: { hand: ['agathe.the-choir-answers'], gauges: { agathe: 100 } },
    play: [{ card: 'agathe.the-choir-answers' }, { ultimate: 'agathe' }],
    // 1 + 2 + 3 Tentacles at 9 + 3 per hit, all volleyed once by the ultimate.
    expect: { resources: { tentacles: 6, potency: 12 }, enemyHp: [600 - 72] },
  });

  scenario('The Riddle Answered: 2 Essence, held Rituals cheaper; Transcended Hours Kept doubles', {
    setup: { hand: ['anthe.votive-candle', 'anthe.the-riddle-answered'], gauges: { anthe: 100 } },
    play: [{ card: 'anthe.the-riddle-answered' }, { endTurn: true }, { ultimate: 'anthe' }],
    // The card 2, Vigil 2, then Votive held 1 turn × 2. Votive: 5, −1 from the card, −1 at cleanup.
    expect: { resources: { essence: 2 + 2 + 2 } },
    check: ({ state }) => {
      const votive = state.piles.hand.find((c) => c.card === 'anthe.votive-candle');
      expect(votive && cardCost(state, votive, registry)).toBe(3);
    },
  });

  scenario('Call in the Debts: draw 2, gain 2 Mana; Transcended Balance the Books also draws 2', {
    setup: { hand: ['leonora.call-in-the-debts'], gauges: { leonora: 100 } },
    play: [{ card: 'leonora.call-in-the-debts' }, { ultimate: 'leonora' }],
    expect: { mana: 6 - 3 + 2 + 3, handSize: 4 },
  });

  it('a Transcend card resolves once per combat: a repeat of it fizzles and charges once', () => {
    const run = runScenario({
      setup: { hand: ['maelia.bud-cutting', 'agathe.the-choir-answers'], mana: 10 },
      play: [{ card: 'maelia.bud-cutting' }, { card: 'agathe.the-choir-answers' }],
    });
    const events = run.plays[1]?.events ?? [];
    expect(events.filter((e) => e.type === 'transcended')).toHaveLength(1);
    expect(run.state.members.find((m) => m.character === 'agathe')?.gauge).toBe(35);
  });
});

describe('ultimates', () => {
  it('cannot fire below a full gauge, or outside the player phase', () => {
    const { state } = startCombat({ seed: 1, party: STARTER_PARTY, enemies: [DUMMY], gauges: [99, 100] }, registry);
    expect(apply(state, { type: 'fireUltimate', member: 'm0' }, registry)).toMatchObject({ ok: false, reason: 'That ultimate is not charged.' });
    expect(apply({ ...state, phase: 'enemy' }, { type: 'fireUltimate', member: 'm1' }, registry).ok).toBe(false);
    expect(apply(state, { type: 'fireUltimate', member: 'm1' }, registry).ok).toBe(true);
  });

  it('Strike and Defense charge their owner 10, Transcend 35, and Flavour cards nothing unless they say so', () => {
    for (const who of STARTER_PARTY) {
      const bySlot = Object.fromEntries((registry.characters[who]?.cards ?? []).map((id) => [registry.cards[id]?.slot, registry.cards[id]?.charge ?? 0]));
      expect(bySlot).toEqual({ strike: 10, defense: 10, transcend: 35, flavourA: 0, flavourB: 0 });
    }
  });
});
