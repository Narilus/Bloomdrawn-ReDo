import { add, applyStatus, damage, draw, gainResource, gainShield, stat, transcend } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { tentacleVolley } from '../domains/rapture.ts';
import { danceOfBells } from '../statuses/dance.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'isadora.strike', name: 'Strike', owner: 'isadora', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'isadora.defense', name: 'Defense', owner: 'isadora', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const ankleBells = card({
  id: 'isadora.ankle-bells', name: 'Ankle Bells', owner: 'isadora', slot: 'flavourA', cost: 2, target: 'none',
  effects: [gainResource('tentacles', 2), gainResource('potency', 1)],
  text: 'Gain {effects.0.amount} Tentacles. Tentacles deal +{effects.1.amount} damage for the rest of combat.',
});

export const ecstaticSpin = card({
  id: 'isadora.ecstatic-spin', name: 'Ecstatic Spin', owner: 'isadora', slot: 'flavourB', cost: 4, target: 'allEnemies',
  effects: [tentacleVolley(), tentacleVolley()],
  text: 'Trigger a volley twice.',
});

export const theVeilTorn = card({
  id: 'isadora.the-veil-torn', name: 'The Veil Torn', owner: 'isadora', slot: 'transcend', cost: 4, target: 'allEnemies',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('tentacles', 3), tentacleVolley(), transcend()],
  text: 'Gain {effects.0.amount} Tentacles. Trigger a volley. Transcend.',
});

// Card rewards (docs/notes/banner-kits.md). Numbers are placeholders.

export const petalRibbon = card({
  id: 'isadora.petal-ribbon', name: 'Petal Ribbon', owner: 'isadora', reward: true, cost: 1, target: 'none',
  effects: [gainResource('potency', 1), draw(1)],
  text: 'Tentacles deal +{effects.0.amount} damage for the rest of combat. Draw {effects.1.count} card.',
});

export const ribbonLash = card({
  id: 'isadora.ribbon-lash', name: 'Ribbon Lash', owner: 'isadora', reward: true, cost: 2, target: 'chosenEnemy',
  effects: [damage(add(3, stat('attack'))), tentacleVolley()],
  text: 'Deal {effects.0.amount} damage. Trigger a volley.',
});

export const isadora = character({
  id: 'isadora', name: 'Isadora', title: 'the Ecstatic', domain: 'rapture',
  stats: { hp: 50, attack: 5, defense: 3 },
  cards: [strike, defense, theVeilTorn, ankleBells, ecstaticSpin],
  passive: {
    name: 'Rapt', scope: 'combat',
    text: 'The first time each turn a card triggers a volley, Tentacles deal +{triggers.0.do.0.amount} damage for the rest of combat.',
    triggers: [{ on: 'volleyFired', filter: { fromCard: true }, once: 'turn', do: [gainResource('potency', 1)] }],
  },
  ultimate: {
    name: 'Dance of Bells',
    text: 'This turn, every volley hits twice, the end-of-turn attack included.',
    effects: [applyStatus(danceOfBells, 1, 'self')],
    transcended: {
      text: 'This turn, every volley hits twice, the end-of-turn attack included. Trigger a volley now.',
      effects: [applyStatus(danceOfBells, 1, 'self'), tentacleVolley()],
    },
  },
});
