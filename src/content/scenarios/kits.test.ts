import { describe, expect, it } from 'vitest';
import { apply, cardCost, startCombat } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario, STARTER_PARTY } from '../testing/scenario.ts';

// The approved starter kits (docs/notes/starter-kits.md), one scenario per card, passive and
// ultimate. The party is Maelia, Agathe, Anthe, Leonora against a 60-HP training dummy, so
// Agathe's First Hymn Tentacle (3 damage) hits at every end of turn.
const DUMMY = 'enemy.training-dummy';

describe('Maelia', () => {
  scenario("Swollen Pod gains 3 Embryo, 1 more from Midwife's Hands, and Poisons every enemy", {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.swollen-pod'] },
    play: [{ card: 'maelia.swollen-pod' }],
    expect: { resources: { embryo: 4 }, mana: 4 },
    check: ({ state }) => expect(state.enemies.map((e) => e.statuses)).toEqual([
      [{ status: 'status.poison', stacks: 2 }],
      [{ status: 'status.poison', stacks: 2 }],
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
    expect: { resources: { embryo: 0 }, enemyHp: [60 - 9 - 9], gauges: { maelia: 20, agathe: 10, anthe: 10, leonora: 10 } },
  });

  scenario('Bud Cutting without 2 Embryo spends and charges nothing, but still repeats', {
    setup: { hand: ['maelia.bud-cutting', 'maelia.swollen-pod'], resources: { embryo: 1 } },
    play: [{ card: 'maelia.bud-cutting' }, { card: 'maelia.swollen-pod' }],
    expect: { resources: { embryo: 1 + 4 + 3 }, gauges: { maelia: 0, agathe: 0, anthe: 0, leonora: 0 } },
    check: ({ state }) => expect(state.enemies[0]?.statuses).toEqual([{ status: 'status.poison', stacks: 4 }]),
  });

  scenario('Birthing Bloom consumes all Embryo: heal 3 and Shield 4 per Embryo, preview equal to result', {
    setup: { hand: [], gauges: { maelia: 100 }, resources: { embryo: 5 }, partyHp: 150 },
    play: [{ ultimate: 'maelia' }],
    expect: { resources: { embryo: 0 }, partyHp: 165, partyShield: 20, gauges: { maelia: 0 }, mana: 6 },
    check: ({ plays }) => {
      const branch = plays[0]?.preview[0]?.branch ?? [];
      expect(branch.map((p) => [p.op, p.amount])).toEqual([['heal', 15], ['gainShield', 20]]);
    },
  });
});

describe('Agathe', () => {
  scenario('First Hymn: the fight starts with a Tentacle', {
    play: [],
    expect: { resources: { tentacles: 1, potency: 3 } },
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

  scenario('Censer Rite: +2 damage per hit for the rest of combat, and a volley now', {
    setup: { hand: ['agathe.censer-rite'], resources: { tentacles: 2 } },
    play: [{ card: 'agathe.censer-rite' }, { endTurn: true }],
    // Volley now: 2 × 5. End of turn: 2 × 5 again, still at 5 per hit.
    expect: { resources: { potency: 5, tentacles: 2 }, enemyHp: [60 - 10 - 10] },
    check: ({ plays }) => expect(plays[0]?.preview.filter((p) => p.op === 'volley').map((p) => p.amount)).toEqual([5, 5]),
  });

  scenario('Hymn of the Hundred Arms gains 3 Tentacles', {
    setup: { hand: [], gauges: { agathe: 100 } },
    play: [{ ultimate: 'agathe' }],
    expect: { resources: { tentacles: 4 }, gauges: { agathe: 0 } },
  });
});

describe('Anthe', () => {
  scenario('Votive Candle deals 8 + 3 × Essence', {
    setup: { hand: ['anthe.votive-candle'], resources: { essence: 4 } },
    play: [{ card: 'anthe.votive-candle', target: 0 }],
    expect: { enemyHp: [60 - 20], mana: 1 },
  });

  scenario('Vigil: each Ritual held at end of turn gains 1 Essence, and the Ritual gets 1 cheaper', {
    setup: { hand: ['anthe.votive-candle'] },
    play: [{ endTurn: true }],
    expect: { resources: { essence: 1 } },
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
    // Vigil gave 1 each turn; Votive has been held 2 turns.
    expect: { resources: { essence: 2 + 2 }, gauges: { anthe: 0 } },
  });
});

describe('Leonora', () => {
  scenario('Promissory Note: Mana now, debt off the next refill, and Running Tab draws an extra card', {
    setup: { hand: ['leonora.promissory-note'] },
    play: [{ card: 'leonora.promissory-note' }, { endTurn: true }],
    expect: { mana: 4, handSize: 6 },
    check: ({ plays }) => expect(plays[0]?.after.mana).toBe(6 - 2 + 4),
  });

  scenario('Requisition: draw 2, and the next card costs 2 less', {
    setup: { hand: ['leonora.requisition', 'leonora.strike'] },
    play: [{ card: 'leonora.requisition' }, { card: 'leonora.strike', target: 0 }],
    expect: { mana: 4, handSize: 2, enemyHp: [60 - 11] },
  });

  scenario('Balance the Books gains the Mana spent this turn', {
    setup: { hand: ['leonora.strike', 'leonora.promissory-note'], gauges: { leonora: 100 } },
    play: [{ card: 'leonora.strike', target: 0 }, { card: 'leonora.promissory-note' }, { ultimate: 'leonora' }],
    expect: { mana: 6 - 1 - 2 + 4 + 3, gauges: { leonora: 0 } },
  });
});

describe('ultimates', () => {
  it('cannot fire below a full gauge, or outside the player phase', () => {
    const { state } = startCombat({ seed: 1, party: STARTER_PARTY, enemies: [DUMMY], gauges: [99, 100] }, registry);
    expect(apply(state, { type: 'fireUltimate', member: 'm0' }, registry)).toMatchObject({ ok: false, reason: 'That ultimate is not charged.' });
    expect(apply({ ...state, phase: 'enemy' }, { type: 'fireUltimate', member: 'm1' }, registry).ok).toBe(false);
    expect(apply(state, { type: 'fireUltimate', member: 'm1' }, registry).ok).toBe(true);
  });

  it('a Strike or Defense charges its owner 10; Flavour cards charge nothing unless they say so', () => {
    const charge = (id: string) => registry.cards[id]?.charge ?? 0;
    for (const who of STARTER_PARTY) {
      expect([charge(`${who}.strike`), charge(`${who}.defense`)]).toEqual([10, 10]);
      const flavour = registry.characters[who]?.cards.filter((c) => !c.endsWith('.strike') && !c.endsWith('.defense')) ?? [];
      expect(flavour.map(charge)).toEqual([0, 0]);
    }
  });
});
