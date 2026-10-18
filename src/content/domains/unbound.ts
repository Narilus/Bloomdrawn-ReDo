import { domain } from '../define.ts';

// No resource and no shared mechanic: Unbound kits use the Mana, draw and cost operations directly.
export const unbound = domain({ id: 'unbound', name: 'Unbound', resources: [] });
