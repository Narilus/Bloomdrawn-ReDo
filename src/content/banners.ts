import type { BannerDef } from '../engine/index.ts';

// The character banner (owner, 28 Oct; docs/DESIGN.md, "Banners"): there is no Standard banner. The
// player picks a Focus from the pool, and a lost 50/50 gives another pool character. New characters
// join the pool for good; the starters never do. Before weapons, an SR gives an ascension material
// and an R gives Memories and Ducats (owner, 25 Oct); the amounts are placeholders.
export const CHARACTER_BANNER: BannerDef = {
  id: 'banner.character',
  name: 'Character',
  pity: 'character',
  pool: ['virelle', 'isadora', 'kibane', 'hester'],
  sr: { one: ['material.flesh', 'material.rapture', 'material.spirit', 'material.unbound'], amount: 1 },
  r: { 'memory.faint': 1, money: 100 },
};
