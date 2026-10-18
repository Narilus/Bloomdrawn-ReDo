import { add, damage, gainShield, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Placeholder numbers; tuning happens in M1–M2 with the owner.

export const strike = card({
  id: 'agathe.strike', name: 'Strike', owner: 'agathe', slot: 'strike', cost: 1, target: 'chosenEnemy',
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'agathe.defense', name: 'Defense', owner: 'agathe', slot: 'defense', cost: 1, target: 'self',
  effects: [gainShield(add(5, stat('defense')))],
});

export const agathe = character({
  id: 'agathe', name: 'Agathe', domain: 'rapture',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense],
});
