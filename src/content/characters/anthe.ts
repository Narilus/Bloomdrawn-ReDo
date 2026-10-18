import { add, changeCost, damage, draw, gainResource, gainShield, handCount, heldTurns, mul, resource, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'anthe.strike', name: 'Strike', owner: 'anthe', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'anthe.defense', name: 'Defense', owner: 'anthe', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const votiveCandle = card({
  id: 'anthe.votive-candle', name: 'Votive Candle', owner: 'anthe', slot: 'flavourA', cost: 5, target: 'chosenEnemy',
  keywords: ['ritual'],
  effects: [damage(add(8, mul(3, resource('essence'))))],
});

export const gildedThread = card({
  id: 'anthe.gilded-thread', name: 'Gilded Thread', owner: 'anthe', slot: 'flavourB', cost: 2, target: 'none',
  effects: [changeCost(-1, 'hand', 'ritual'), gainResource('essence', 1), draw(1)],
});

export const anthe = character({
  id: 'anthe', name: 'Anthe', domain: 'spirit',
  stats: { hp: 60, attack: 3, defense: 5 },
  cards: [strike, defense, votiveCandle, gildedThread],
  passive: {
    name: 'Vigil', scope: 'combat',
    text: 'At end of turn, gain 1 Essence for each Ritual in hand.',
    triggers: [{ on: 'turnEnd', do: [gainResource('essence', handCount('ritual'))] }],
  },
  ultimate: {
    name: 'Hours Kept',
    text: 'Gain 1 Essence for every turn your held Rituals have been held, in total.',
    effects: [gainResource('essence', heldTurns('ritual'))],
  },
});
