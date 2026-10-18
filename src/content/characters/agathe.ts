import { add, damage, draw, gainResource, gainShield, gte, resource, stat, when } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { tentacleVolley } from '../domains/rapture.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'agathe.strike', name: 'Strike', owner: 'agathe', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'agathe.defense', name: 'Defense', owner: 'agathe', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const callTheChoir = card({
  id: 'agathe.call-the-choir', name: 'Call the Choir', owner: 'agathe', slot: 'flavourA', cost: 2, target: 'none',
  effects: [gainResource('tentacles', 2), when(gte(resource('tentacles'), 4), [draw(1)])],
  text: 'Gain {effects.0.amount} Tentacles. If you have {effects.1.condition.gte.1} or more, draw {effects.1.branch.0.count} card.',
});

export const censerRite = card({
  id: 'agathe.censer-rite', name: 'Censer Rite', owner: 'agathe', slot: 'flavourB', cost: 3, target: 'allEnemies',
  effects: [gainResource('potency', 2), tentacleVolley()],
  text: 'Tentacles deal +{effects.0.amount} damage for the rest of combat. Trigger a volley.',
});

export const agathe = character({
  id: 'agathe', name: 'Agathe', domain: 'rapture',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense, callTheChoir, censerRite],
  passive: {
    name: 'First Hymn', scope: 'combat',
    text: 'At combat start, gain {triggers.0.do.0.amount} Tentacle.',
    triggers: [{ on: 'combatStart', do: [gainResource('tentacles', 1)] }],
  },
  ultimate: {
    name: 'Hymn of the Hundred Arms',
    text: 'Gain {effects.0.amount} Tentacles.',
    effects: [gainResource('tentacles', 3)],
  },
});
