import { add, damage, gainShield, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Placeholder numbers; tuning happens in M1–M2 with the owner.

export const strike = card({
  id: 'virelle.strike', name: 'Strike', owner: 'virelle', slot: 'strike', cost: 1, target: 'chosenEnemy',
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'virelle.defense', name: 'Defense', owner: 'virelle', slot: 'defense', cost: 1, target: 'self',
  effects: [gainShield(add(5, stat('defense')))],
});

export const virelle = character({
  id: 'virelle', name: 'Virelle', domain: 'flesh',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense],
});
