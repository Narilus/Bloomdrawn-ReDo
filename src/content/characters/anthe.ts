import { add, changeCost, damage, draw, gainResource, gainShield, handCount, heldTurns, mul, resource, stat, transcend } from '../../engine/index.ts';
import { card, character } from '../define.ts';

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

export const anthe = character({
  id: 'anthe', name: 'Anthe', title: "the Sphinx's Vigil", domain: 'spirit',
  role: 'hybrid',
  stats: { hp: 60, attack: 9, defense: 15 },
  cards: [strike, defense, theRiddleAnswered, votiveCandle, gildedThread],
  passive: {
    name: 'Vigil', scope: 'combat',
    text: 'At end of turn, gain 2 Essence for each Ritual in hand.',
    triggers: [{ on: 'turnEnd', do: [gainResource('essence', mul(2, handCount('ritual')))] }],
  },
  ultimate: {
    name: 'Hours Kept',
    text: 'Gain 1 Essence for every turn your held Rituals have been held, in total.',
    effects: [gainResource('essence', heldTurns('ritual'))],
    transcended: {
      text: 'Gain 2 Essence for every turn your held Rituals have been held, in total.',
      effects: [gainResource('essence', mul(2, heldTurns('ritual')))],
    },
  },
});
