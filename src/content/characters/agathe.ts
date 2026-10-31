import { damage, draw, gainResource, gainShield, gte, mul, resource, stat, transcend, when } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { tentacleVolley } from '../domains/rapture.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'agathe.strike', name: 'Strike', owner: 'agathe', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(2.5, stat('attack')))],
});

export const defense = card({
  id: 'agathe.defense', name: 'Defense', owner: 'agathe', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2.25, stat('defense')))],
});

export const callTheChoir = card({
  id: 'agathe.call-the-choir', name: 'Call the Choir', owner: 'agathe', slot: 'flavourA', cost: 2, target: 'none',
  effects: [gainResource('tentacles', 2), when(gte(resource('tentacles'), 4), [draw(1)])],
  text: 'Gain {effects.0.amount} Tentacles. If you have {effects.1.condition.gte.1} or more, draw {effects.1.branch.0.count} card.',
});

export const censerRite = card({
  id: 'agathe.censer-rite', name: 'Censer Rite', owner: 'agathe', slot: 'flavourB', cost: 3, target: 'allEnemies',
  effects: [gainResource('potency', mul(0.5, stat('attack'))), tentacleVolley()],
  text: 'Tentacles deal +{effects.0.amount} damage for the rest of combat. Trigger a volley.',
});

export const theChoirAnswers = card({
  id: 'agathe.the-choir-answers', name: 'The Choir Answers', owner: 'agathe', slot: 'transcend', cost: 4, target: 'none',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('tentacles', 2), gainResource('potency', mul(0.25, stat('attack'))), transcend()],
  text: 'Gain {effects.0.amount} Tentacles. Tentacles deal +{effects.1.amount} damage for the rest of combat. Transcend.',
});

// Card rewards (docs/notes/m4-run.md), offered after normal fights. Numbers are placeholders.

export const hymnalProcession = card({
  id: 'agathe.hymnal-procession', name: 'Hymnal Procession', owner: 'agathe', reward: true, cost: 2, target: 'none',
  effects: [gainResource('tentacles', 3)],
});

export const thuribleSwing = card({
  id: 'agathe.thurible-swing', name: 'Thurible Swing', owner: 'agathe', reward: true, cost: 1, target: 'chosenEnemy',
  effects: [damage(mul(2, stat('attack'))), when(gte(resource('tentacles'), 4), [tentacleVolley()])],
  text: 'Deal {effects.0.amount} damage. If you have {effects.1.condition.gte.1} or more Tentacles, trigger a volley.',
});

export const agathe = character({
  id: 'agathe', name: 'Agathe', title: 'the Choir-Mother', domain: 'rapture',
  role: 'hybrid',
  stats: { hp: 50, attack: 4, defense: 4 },
  cards: [strike, defense, theChoirAnswers, callTheChoir, censerRite],
  passive: {
    name: 'First Hymn', scope: 'combat',
    text: 'At combat start, gain {triggers.0.do.0.amount} Tentacle.',
    triggers: [{ on: 'combatStart', do: [gainResource('tentacles', 1)] }],
  },
  ultimate: {
    name: 'Hymn of the Hundred Arms',
    text: 'Gain {effects.0.amount} Tentacles.',
    effects: [gainResource('tentacles', 3)],
    transcended: {
      text: 'Gain {effects.0.amount} Tentacles, then trigger a volley.',
      effects: [gainResource('tentacles', 3), tentacleVolley()],
    },
  },
});
