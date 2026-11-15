import { add, changeCost, damage, draw, gainResource, gainShield, handCount, heldTurns, mul, resource, stat, transcend } from '../../engine/index.ts';
import { card, character, p2, variant } from '../define.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning; Ritual damage
// per Essence and Vigil's Essence were doubled from the lab curves (owner, 27 Oct).

export const strike = card({
  id: 'anthe.strike', name: 'Strike', owner: 'anthe', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(3, stat('attack')))],
});

export const defense = card({
  id: 'anthe.defense', name: 'Defense', owner: 'anthe', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2, stat('defense')))],
});

export const votiveCandle = card({
  id: 'anthe.votive-candle', name: 'Votive Candle', owner: 'anthe', slot: 'flavourA', cost: 5, target: 'chosenEnemy',
  keywords: ['ritual'],
  effects: [damage(mul(stat('attack'), add(2.67, mul(2, resource('essence')))))],
});

export const gildedThread = card({
  id: 'anthe.gilded-thread', name: 'Gilded Thread', owner: 'anthe', slot: 'flavourB', cost: 2, target: 'none',
  effects: [changeCost(-1, 'hand', 'ritual'), gainResource('essence', 1), draw(1)],
});

export const theRiddleAnswered = card({
  id: 'anthe.the-riddle-answered', name: 'The Riddle Answered', owner: 'anthe', slot: 'transcend', cost: 4, target: 'none',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('essence', 2), changeCost(-1, 'hand', 'ritual'), transcend()],
  text: 'Gain {effects.0.amount} Essence. Every Ritual in your hand costs 1 less. Transcend.',
});

// Card rewards (docs/notes/m4-run.md), offered after normal fights. Numbers are placeholders.

export const ashOffering = card({
  id: 'anthe.ash-offering', name: 'Ash Offering', owner: 'anthe', reward: true, cost: 1, target: 'none',
  effects: [gainResource('essence', 2)],
});

export const longVigil = card({
  id: 'anthe.long-vigil', name: 'Long Vigil', owner: 'anthe', reward: true, cost: 6, target: 'allEnemies',
  keywords: ['ritual'],
  effects: [damage(mul(stat('attack'), add(3.34, mul(2, resource('essence')))), { target: 'allEnemies' })],
});

// Potential, the lighter set (owner, 15 Nov; docs/notes/starter-kits.md, "Potential"): Shield, cost
// and card flow instead of more Essence. Numbers are placeholders.

// Vigil at P0 gives 2 Essence per Ritual held; at P1 also Shield per Ritual; at P5 held Rituals also
// get 1 cheaper again at cleanup, beside the Domain's own 1.
const vigil = (shield: boolean, cheaper = false) => ({
  name: 'Vigil', scope: 'combat' as const,
  text:
    (shield
      ? 'At end of turn, for each Ritual in hand, gain 2 Essence and Shield equal to her Defense.'
      : 'At end of turn, gain 2 Essence for each Ritual in hand.') + (cheaper ? ' Held Rituals cost 2 less each turn, not 1.' : ''),
  triggers: [
    { on: 'turnEnd' as const, do: [gainResource('essence', mul(2, handCount('ritual'))), ...(shield ? [gainShield(mul(stat('defense'), handCount('ritual')))] : [])] },
    ...(cheaper ? [{ on: 'cleanup' as const, do: [changeCost(-1, 'hand', 'ritual')] }] : []),
  ],
});

// Hours Kept; P4 also draws 1 card.
const hoursKept = (draws: boolean) => {
  const more = draws ? [draw(1)] : [];
  const drawText = draws ? ' Draw {effects.1.count} card.' : '';
  return {
    name: 'Hours Kept',
    text: `Gain 1 Essence for every turn your held Rituals have been held, in total.${drawText}`,
    effects: [gainResource('essence', heldTurns('ritual')), ...more],
    transcended: {
      text: `Gain 2 Essence for every turn your held Rituals have been held, in total.${drawText}`,
      effects: [gainResource('essence', mul(2, heldTurns('ritual'))), ...more],
    },
  };
};

// P3: Votive Candle costs 4.
export const votiveCandleP3 = variant(votiveCandle, 3, { cost: 4 });

const STATS = { hp: 60, attack: 9, defense: 15 };

export const anthe = character({
  id: 'anthe', name: 'Anthe', title: "the Sphinx's Vigil", domain: 'spirit',
  role: 'hybrid',
  stats: STATS,
  cards: [strike, defense, theRiddleAnswered, votiveCandle, gildedThread],
  passive: vigil(false),
  ultimate: hoursKept(false),
  dupes: [
    { text: 'Vigil also gives Shield equal to her Defense for each Ritual in hand.', passive: vigil(true) },
    p2(STATS),
    { text: 'Votive Candle costs 4.', cards: { [votiveCandle.id]: votiveCandleP3.id } },
    { text: 'Hours Kept also draws 1 card.', ultimate: hoursKept(true) },
    { text: 'Held Rituals cost 2 less each turn, not 1.', passive: vigil(true, true) },
  ],
});
