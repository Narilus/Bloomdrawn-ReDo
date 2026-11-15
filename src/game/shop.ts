import { MAX_DUPES } from './gacha.ts';
import type { Profile } from './profile.ts';

// The Profile Shop (docs/notes/m6-depth.md, "Profile Shop"; owner, 31 Oct): character dupes for
// Pollen, the starters' included, so they never need to be in a banner. Other wares come later. It
// never sells pulls.

/** Pollen for one Potential level (owner, 31 Oct; a placeholder until M6.12 Balance). */
export const DUPE_PRICE = 100;

export type ShopResult = { ok: true; profile: Profile; level: number } | { ok: false; reason: string };

/**
 * Buys a character's next Potential level for `DUPE_PRICE` Pollen. `owned` is every character the
 * profile can field, the starters included, and `levels` how many Potential levels each has (none
 * for a character without them). A character not owned, without Potential levels or at her last
 * one, or a purse short of Pollen, is refused and nothing changes.
 */
export function buyDupe(profile: Profile, character: string, owned: readonly string[], levels: number): ShopResult {
  if (!owned.includes(character)) return { ok: false, reason: 'Only characters you own have dupes for sale.' };
  const max = Math.min(levels, MAX_DUPES);
  const level = profile.dupes?.[character] ?? 0;
  if (max === 0) return { ok: false, reason: 'She has no Potential levels yet.' };
  if (level >= max) return { ok: false, reason: `She is already at P${max}.` };
  const pollen = profile.items?.pollen ?? 0;
  if (pollen < DUPE_PRICE) return { ok: false, reason: `A dupe costs ${DUPE_PRICE} Pollen; you have ${pollen}.` };
  return {
    ok: true,
    profile: { ...profile, items: { ...profile.items, pollen: pollen - DUPE_PRICE }, dupes: { ...profile.dupes, [character]: level + 1 } },
    level: level + 1,
  };
}
