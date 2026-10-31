import { add, chargeUltimate, consumed, createCard, damage, draw, gainResource, gainShield, gte, handCount, ifConsume, mul, resource, stat, transcend, when } from '../../engine/index.ts';
import { c2, card, character, variant } from '../define.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning;
// Ritual damage per Essence and Foxfire's Essence were doubled from the lab curves (owner, 27 Oct).

export const strike = card({
  id: 'kibane.strike', name: 'Strike', owner: 'kibane', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(2.2, stat('attack')))],
});

export const defense = card({
  id: 'kibane.defense', name: 'Defense', owner: 'kibane', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2.67, stat('defense')))],
});

export const foxfireRite = card({
  id: 'kibane.foxfire-rite', name: 'Foxfire Rite', owner: 'kibane', slot: 'flavourA', cost: 5, target: 'chosenEnemy',
  keywords: ['ritual'],
  effects: [damage(mul(stat('attack'), add(0.8, mul(2, resource('essence')))))],
});

export const shrineBell = card({
  id: 'kibane.shrine-bell', name: 'Shrine Bell', owner: 'kibane', slot: 'flavourB', cost: 2, target: 'none',
  effects: [gainResource('essence', 2), when(gte(handCount('ritual'), 1), [gainResource('essence', 1)])],
  text: 'Gain {effects.0.amount} Essence. If you hold a Ritual, gain {effects.1.branch.0.amount} more.',
});

export const foxfireWisp = card({
  id: 'kibane.foxfire-wisp', name: 'Foxfire Wisp', owner: 'kibane', generated: true, cost: 3, target: 'chosenEnemy',
  keywords: ['ritual', 'exhaust'],
  effects: [damage(mul(1.2, stat('attack'), resource('essence')))],
});

export const theNinthTail = card({
  id: 'kibane.the-ninth-tail', name: 'The Ninth Tail', owner: 'kibane', slot: 'transcend', cost: 4, target: 'none',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('essence', 3), createCard(foxfireWisp), transcend()],
  text: 'Gain {effects.0.amount} Essence. Create a Foxfire Wisp in your hand. Transcend.',
});

// Card rewards (docs/notes/banner-kits.md). Numbers are placeholders.

export const foxLantern = card({
  id: 'kibane.fox-lantern', name: 'Fox Lantern', owner: 'kibane', reward: true, cost: 1, target: 'none',
  effects: [gainResource('essence', 1), draw(1)],
});

export const gauntletRake = card({
  id: 'kibane.gauntlet-rake', name: 'Gauntlet Rake', owner: 'kibane', reward: true, cost: 2, target: 'chosenEnemy',
  effects: [damage(mul(2, stat('attack'))), gainResource('essence', 1)],
});

// Spirit's one exception: it spends the shared Essence, Anthe's included. Hits every enemy (owner, 25 Oct).
// At C5 half the Essence consumed, rounded down, comes back.
// Damage is 200% of her Attack plus `each` × her Attack per Essence consumed.
const judgement = (each: number, refund = false) => [
  ifConsume('essence', resource('essence'), [
    damage(add(mul(2, stat('attack')), mul(mul(each, stat('attack')), consumed())), { target: 'allEnemies' }),
    ...(refund ? [gainResource('essence', mul(0.5, consumed()))] : []),
  ]),
];
const judgementText = (refund = false) =>
  'Consume all Essence. Deal {effects.0.branch.0.amount.add.0} + {effects.0.branch.0.amount.add.1.mul.0} × Essence consumed damage to all enemies.' +
  (refund ? ' Gain back half the Essence consumed, rounded down.' : '');
// 160% of Attack per Essence (240% Transcended); C4 adds 40% (+2 at Attack 5), Transcended too.
const kyubi = (bonus: number, refund = false) => ({
  name: "Kyubi's Judgement",
  text: judgementText(refund),
  effects: judgement(1.6 + bonus, refund),
  transcended: { text: judgementText(refund), effects: judgement(2.4 + bonus, refund) },
});

// Foxfire at C0 charges 10 per Ritual played, at C1 15.
const foxfire = (charge: number) => ({
  name: 'Foxfire', scope: 'combat' as const,
  text: 'At end of turn, gain 2 Essence for each Ritual in hand. When you play a Ritual, charge her ultimate by {triggers.1.do.0.amount}.',
  triggers: [
    { on: 'turnEnd' as const, do: [gainResource('essence', mul(2, handCount('ritual')))] },
    { on: 'cardPlayed' as const, filter: { keyword: 'ritual' as const, source: 'party' as const }, do: [chargeUltimate(charge)] },
  ],
});

// C3: more damage per Essence. Placeholder 12 × (the draft's 5 to 6, a fifth more, on today's 10); the owner sets it.
export const foxfireRiteC3 = variant(foxfireRite, 3, { effects: [damage(mul(stat('attack'), add(0.8, mul(2.4, resource('essence')))))] });

const STATS = { hp: 50, attack: 15, defense: 9 };

export const kibane = character({
  id: 'kibane', name: 'Kibane', title: 'the Nine-Tailed', domain: 'spirit',
  role: 'attacker',
  stats: STATS,
  cards: [strike, defense, theNinthTail, foxfireRite, shrineBell],
  passive: foxfire(10),
  ultimate: kyubi(0),
  dupes: [
    { text: 'Foxfire charges 15.', passive: foxfire(15) },
    c2(STATS),
    { text: 'Foxfire Rite deals 12 × Essence.', cards: { [foxfireRite.id]: foxfireRiteC3.id } },
    { text: "Kyubi's Judgement deals +2 per Essence consumed.", ultimate: kyubi(0.4) },
    { text: "After Kyubi's Judgement, gain back half the Essence consumed, rounded down.", ultimate: kyubi(0.4, true) },
  ],
});
