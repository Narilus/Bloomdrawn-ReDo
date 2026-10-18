import { resource, volley } from '../../engine/index.ts';
import { domain } from '../define.ts';

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
  counter: { label: 'Tentacles', count: resource('tentacles'), each: resource('potency') },
});
