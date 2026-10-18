import { add, damage, gainShield, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Placeholder numbers; tuning happens in M1–M2 with the owner.

export const strike = card({
  id: 'anthe.strike', name: 'Strike', owner: 'anthe', slot: 'strike', cost: 1, target: 'chosenEnemy',
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'anthe.defense', name: 'Defense', owner: 'anthe', slot: 'defense', cost: 1, target: 'self',
  effects: [gainShield(add(5, stat('defense')))],
});

export const anthe = character({
  id: 'anthe', name: 'Anthe', domain: 'spirit',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense],
});
