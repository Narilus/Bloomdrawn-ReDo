import type { CharacterDef, Registry, Stats, WeaponDef, WeaponStep } from './defs.ts';
import { critOf, CRIT_RATE_MAX, withGrowth } from './levels.ts';
import type { Member } from './state.ts';

// Dupe levels (DESIGN.md, "Character dupes"): C1 to C5 each replace parts of a character from that
// level up. Combat reads a member's character only through `characterOf`, so her dupe level and her
// level and ascensions (`levels.ts`) apply everywhere: stats, passive, ultimate and the cards dealt.

/** The character as she is at a dupe level: each level up to it applied in order. */
export function withDupes(def: CharacterDef, level = 0): CharacterDef {
  let out = def;
  for (const dupe of (def.dupes ?? []).slice(0, Math.max(0, level))) {
    out = {
      ...out,
      ...(dupe.stats && { stats: dupe.stats }),
      ...(dupe.passive && { passive: dupe.passive }),
      ...(dupe.ultimate && { ultimate: dupe.ultimate }),
      ...(dupe.cards && { cards: out.cards.map((id) => dupe.cards?.[id] ?? id) }),
    };
  }
  return out;
}

/** A party member's character at her dupe level, then her level and ascensions, then her weapon's main stat. */
export function characterOf(member: Member, registry: Registry): CharacterDef | undefined {
  const def = registry.characters[member.character];
  if (!def) return undefined;
  const grown = withGrowth(withDupes(def, member.dupes), member.level, member.ascensions);
  const weapon = member.weapon && registry.weapons[member.weapon.weapon];
  return weapon ? { ...grown, stats: withWeaponStat(grown.stats, weapon) } : grown;
}

/**
 * Stats with a weapon's main stat (docs/notes/weapons.md): HP, Attack or Defense grow by a share of
 * themselves, rounded; crit rate and crit damage take the points on top of the character's own.
 */
export function withWeaponStat(stats: Stats, weapon: WeaponDef): Stats {
  const { stat, amount } = weapon.main;
  if (stat === 'critRate' || stat === 'critDamage') {
    const crit = critOf(stats);
    return stat === 'critRate' ? { ...stats, critRate: Math.min(CRIT_RATE_MAX, crit.rate + amount) } : { ...stats, critDamage: crit.damage + amount };
  }
  return { ...stats, [stat]: Math.round(stats[stat] * (1 + amount / 100)) };
}

/** A member's weapon's effect at its reinforcement step, if she wields one. */
export function weaponOf(member: Member, registry: Registry): WeaponStep | undefined {
  const w = member.weapon;
  const def = w && registry.weapons[w.weapon];
  return def && def.steps[Math.min(def.steps.length - 1, Math.max(0, w.step ?? 0))];
}
