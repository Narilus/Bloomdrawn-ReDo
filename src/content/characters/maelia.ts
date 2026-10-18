import { add, damage, gainShield, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Placeholder numbers; tuning happens in M1–M2 with the owner.

export const strike = card({
  id: 'maelia.strike', name: 'Strike', owner: 'maelia', slot: 'strike', cost: 1, target: 'chosenEnemy',
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'maelia.defense', name: 'Defense', owner: 'maelia', slot: 'defense', cost: 1, target: 'self',
  effects: [gainShield(add(5, stat('defense')))],
});

export const maelia = character({
  id: 'maelia', name: 'Maelia', domain: 'flesh',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense],
});
