import { add, changeCost, gainShield, mul, resource } from '../../engine/index.ts';
import { card, domain } from '../define.ts';

// Rituals Retain (the engine keeps them at cleanup); each cleanup they are held through makes them 1 cheaper, to 0.
export const spirit = domain({
  id: 'spirit', name: 'Spirit', material: 'material.spirit',
  resources: [{ id: 'essence', name: 'Essence' }],
  counter: {
    label: 'Essence', icon: 'essence', count: resource('essence'),
    help: 'Rituals grow stronger with Essence. A held Ritual stays in hand and costs 1 less each turn, down to 0.',
  },
  triggers: [{ on: 'cleanup', do: [changeCost(-1, 'hand', 'ritual')] }],
});

// The Domain's generic card reward (docs/notes/m4-run.md): any Spirit member may own it. Numbers are placeholders.
export const quietPrayer = card({
  id: 'spirit.quiet-prayer', name: 'Quiet Prayer', domain: 'spirit', reward: true, cost: 4, target: 'self',
  keywords: ['ritual'],
  effects: [gainShield(add(8, mul(2, resource('essence'))))],
});
