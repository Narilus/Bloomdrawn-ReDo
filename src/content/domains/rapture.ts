import { add, gainResource, gainShield, resource, stat, volley } from '../../engine/index.ts';
import { card, domain } from '../define.ts';

/** Every Tentacle hits once for the damage per hit. Mid-turn volleys use the same call and consume nothing. */
export const tentacleVolley = () => volley(resource('tentacles'), resource('potency'));

// Damage per hit starts at 3; raises to it last the whole combat, so Tentacle damage ramps.
export const rapture = domain({
  id: 'rapture', name: 'Rapture',
  resources: [
    { id: 'tentacles', name: 'Tentacles' },
    { id: 'potency', name: 'damage per hit', start: 3 },
  ],
  triggers: [{ on: 'turnEnd', do: [tentacleVolley()] }],
  counter: {
    label: 'Tentacles', icon: 'tentacle', count: resource('tentacles'), each: resource('potency'),
    help: 'At end of turn every Tentacle hits once, lowest-HP enemy first; excess damage carries to the next. Volleys from cards hit the same way and spend nothing.',
  },
});

// The Domain's generic card reward (docs/notes/m4-run.md): any Rapture member may own it. Numbers are placeholders.
export const chalkCircle = card({
  id: 'rapture.chalk-circle', name: 'Chalk Circle', domain: 'rapture', reward: true, cost: 1, target: 'self',
  effects: [gainResource('tentacles', 1), gainShield(add(4, stat('defense')))],
  text: 'Gain {effects.0.amount} Tentacle. Gain {effects.1.amount} Shield.',
});
