import type { BannerDef } from '../engine/index.ts';

// The Standard banner (docs/notes/m5-collection.md, "The gacha"): the banner four, and no starter
// ever. Before weapons, an SR gives an ascension material and an R gives Memories and Ducats (owner,
// 25 Oct); the amounts are placeholders.
export const STANDARD_BANNER: BannerDef = {
  id: 'banner.standard',
  name: 'Standard',
  pity: 'standard',
  ssr: ['virelle', 'isadora', 'kibane', 'hester'],
  sr: { one: ['material.flesh', 'material.rapture', 'material.spirit', 'material.unbound'], amount: 1 },
  r: { 'memory.faint': 1, money: 100 },
};
