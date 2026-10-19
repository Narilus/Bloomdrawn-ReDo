import { changeCost, resource } from '../../engine/index.ts';
import { domain } from '../define.ts';

// Rituals Retain (the engine keeps them at cleanup); each cleanup they are held through makes them 1 cheaper, to 0.
export const spirit = domain({
  id: 'spirit', name: 'Spirit',
  resources: [{ id: 'essence', name: 'Essence' }],
  counter: {
    label: 'Essence', icon: 'essence', count: resource('essence'),
    help: 'Rituals grow stronger with Essence. A held Ritual stays in hand and costs 1 less each turn, down to 0.',
  },
  triggers: [{ on: 'cleanup', do: [changeCost(-1, 'hand', 'ritual')] }],
});
