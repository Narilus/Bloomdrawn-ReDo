import { draw } from '../../engine/index.ts';
import { card, domain } from '../define.ts';

// No resource and no shared mechanic: Unbound kits use the Mana, draw and cost operations directly.
// Unbound slots into any team, so its generic cards are offered to every party and go to any member.
export const unbound = domain({ id: 'unbound', name: 'Unbound', resources: [], anyTeam: true });

// The Domain's generic card reward (docs/notes/m4-run.md). Numbers are placeholders.
export const pocketWatch = card({
  id: 'unbound.pocket-watch', name: 'Pocket Watch', domain: 'unbound', reward: true, cost: 1, target: 'none',
  effects: [draw(2)],
});
