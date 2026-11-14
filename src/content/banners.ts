import type { BannerDef } from '../engine/index.ts';
import * as domainWeapons from './weapons/domains.ts';
import * as signatures from './weapons/signatures.ts';

// The banners (owner, 28 Oct; docs/DESIGN.md, "Banners"): there is no Standard banner. The player
// picks a Focus from a pool, and a lost 50/50 gives another pool entry. New characters join the
// character pool for good; the starters never do. The weapon banner's pool is all eight signatures,
// the starters' included (owner, 14 Nov). On both, an SR is a random SR weapon and an R is half the
// time a random R weapon, otherwise Memories and Ducats (docs/notes/weapons.md); amounts are placeholders.

const generic = Object.values(domainWeapons);
const SR_WEAPONS = generic.filter((w) => w.rarity === 'sr').map((w) => w.id);
const R = { weapons: generic.filter((w) => w.rarity === 'r').map((w) => w.id), chance: 0.5, items: { 'memory.faint': 1, money: 100 } };

export const CHARACTER_BANNER: BannerDef = {
  id: 'banner.character',
  name: 'Character',
  kind: 'character',
  pity: 'character',
  pool: ['virelle', 'isadora', 'kibane', 'hester'],
  sr: SR_WEAPONS,
  r: R,
};

export const WEAPON_BANNER: BannerDef = {
  id: 'banner.weapon',
  name: 'Weapon',
  kind: 'weapon',
  pity: 'weapon',
  pool: Object.values(signatures).map((w) => w.id),
  sr: SR_WEAPONS,
  r: R,
};
