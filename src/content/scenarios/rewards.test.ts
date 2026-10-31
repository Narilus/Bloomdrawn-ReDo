import { describe, expect } from 'vitest';
import type { CombatState } from '../../engine/index.ts';
import { scenario } from '../testing/scenario.ts';

// The M4 card rewards (docs/notes/m4-run.md), one scenario per card. The party is Maelia (Attack 9),
// Agathe (12), Anthe (9) and Leonora (15) against 600-HP training dummies; Agathe starts each fight
// with 1 Tentacle, and Tentacles hit for 9.
const DUMMY = 'enemy.training-dummy';
const statusesOf = (state: CombatState) => state.enemies.map((e) => e.statuses.map((s) => `${s.status} ${s.stacks}`));

describe('Maelia', () => {
  scenario("Nursing Bud gains 2 Embryo, 1 more from Midwife's Hands, and charges its owner's ultimate by 10", {
    setup: { hand: ['maelia.nursing-bud'] },
    play: [{ card: 'maelia.nursing-bud' }],
    expect: { resources: { embryo: 3 }, gauges: { maelia: 10, agathe: 0 }, mana: 5 },
  });

  scenario('Pollen Drift Poisons every enemy by 400% of her Attack, without Embryo to consume', {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.pollen-drift'] },
    play: [{ card: 'maelia.pollen-drift' }],
    check: ({ state }) => expect(statusesOf(state)).toEqual([['status.poison 36'], ['status.poison 36']]),
  });

  scenario('Pollen Drift consumes 2 Embryo to Poison every enemy by as much again', {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['maelia.pollen-drift'], resources: { embryo: 3 } },
    play: [{ card: 'maelia.pollen-drift' }],
    expect: { resources: { embryo: 1 } },
    check: ({ state }) => expect(statusesOf(state)).toEqual([['status.poison 72'], ['status.poison 72']]),
  });
});

describe('Agathe', () => {
  scenario('Hymnal Procession gains 3 Tentacles', {
    setup: { hand: ['agathe.hymnal-procession'] },
    play: [{ card: 'agathe.hymnal-procession' }],
    expect: { resources: { tentacles: 1 + 3 }, mana: 4 },
  });

  scenario('Thurible Swing deals 200% of Attack, and with 4 Tentacles triggers a volley', {
    setup: { hand: ['agathe.thurible-swing'], resources: { tentacles: 4 } },
    play: [{ card: 'agathe.thurible-swing', target: 0 }],
    // 200% of Attack 12 = 24; then 4 Tentacles × 9 = 36.
    expect: { enemyHp: [600 - 24 - 36], resources: { tentacles: 4 } },
  });

  scenario('Thurible Swing with fewer than 4 Tentacles only strikes', {
    setup: { hand: ['agathe.thurible-swing'], resources: { tentacles: 3 } },
    play: [{ card: 'agathe.thurible-swing', target: 0 }],
    expect: { enemyHp: [600 - 24] },
  });
});

describe('Anthe', () => {
  scenario('Ash Offering gains 2 Essence', {
    setup: { hand: ['anthe.ash-offering'] },
    play: [{ card: 'anthe.ash-offering' }],
    expect: { resources: { essence: 2 }, mana: 5 },
  });

  scenario('Long Vigil is a Ritual that deals 334% of Attack plus 200% per Essence (30 + 18 × Essence) to every enemy', {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['anthe.long-vigil'], resources: { essence: 2 } },
    play: [{ card: 'anthe.long-vigil' }],
    // Attack 9 × (3.34 + 2 × 2).
    expect: { enemyHp: [600 - 66, 600 - 66], mana: 0 },
    check: ({ plays }) => expect(plays[0]!.preview.map((p) => [p.target, p.amount])).toEqual([['e20', 66], ['e21', 66]]),
  });
});

describe('Leonora', () => {
  scenario('Ledger Balance draws 1, and the next card costs 1 less', {
    setup: { hand: ['leonora.ledger-balance', 'leonora.writ-of-seizure'], mana: 3 },
    play: [{ card: 'leonora.ledger-balance' }, { card: 'leonora.writ-of-seizure', target: 0 }],
    // 3 - 1, then Writ of Seizure at 2 - 1.
    expect: { mana: 1, handSize: 1 },
  });

  scenario('Writ of Seizure applies 2 Weak and 2 Vulnerable to an enemy', {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['leonora.writ-of-seizure'] },
    play: [{ card: 'leonora.writ-of-seizure', target: 1 }],
    check: ({ state }) => expect(statusesOf(state)).toEqual([[], ['status.weak 2', 'status.vulnerable 2']]),
  });
});

describe("the Domains' generic cards, played by the member they went to", () => {
  scenario("Grafting Knife deals 234% of its owner's Attack and applies 300% of it in Bleed", {
    setup: { hand: [{ card: 'flesh.grafting-knife', owner: 'agathe' }] },
    play: [{ card: 'flesh.grafting-knife', target: 0 }],
    // Agathe's Attack is 12, so 28 and 36 (Maelia's 9 makes 21 and 27).
    expect: { enemyHp: [600 - 28] },
    check: ({ state }) => expect(statusesOf(state)).toEqual([['status.bleed 36']]),
  });

  scenario("Chalk Circle gains 1 Tentacle and 200% of its owner's Defense in Shield", {
    setup: { hand: [{ card: 'rapture.chalk-circle', owner: 'agathe' }] },
    play: [{ card: 'rapture.chalk-circle' }],
    // 200% of Agathe's Defense 12.
    expect: { resources: { tentacles: 1 + 1 }, partyShield: 24 },
  });

  scenario('Quiet Prayer is a Ritual that gains 160% of Defense plus 40% per Essence (24 + 6 × Essence) in Shield', {
    setup: { hand: [{ card: 'spirit.quiet-prayer', owner: 'anthe' }], resources: { essence: 3 } },
    play: [{ card: 'spirit.quiet-prayer' }],
    expect: { partyShield: 24 + 18, mana: 2 },
  });

  scenario('Pocket Watch draws 2 cards', {
    setup: { hand: [{ card: 'unbound.pocket-watch', owner: 'maelia' }] },
    play: [{ card: 'unbound.pocket-watch' }],
    expect: { handSize: 2, mana: 5 },
    check: ({ plays }) => expect(plays[0]!.before.piles.hand[0]!.owner).toBe('m0'),
  });
});
