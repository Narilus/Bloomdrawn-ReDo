import type { CharacterDef } from './defs.ts';

// Character levels (DESIGN.md, "RPG layer"; owner, 29 Oct, placeholders): each level past 1 adds a
// small share of base HP, Attack and Defense, rounded, so cards grow slowly. Level 1 is the
// character as written. Base is her stats at her dupe level, so C2's stats grow too.

/** The share of base each level past 1 adds. */
export const LEVEL_GROWTH = 0.025;

/** Stats at a level: base × (1 + 2.5% per level past 1), each rounded. */
export function statsAtLevel(stats: CharacterDef['stats'], level = 1): CharacterDef['stats'] {
  const grow = (n: number) => Math.round(n * (1 + LEVEL_GROWTH * Math.max(0, level - 1)));
  return { hp: grow(stats.hp), attack: grow(stats.attack), defense: grow(stats.defense) };
}

/** The character at a level; level 1 (or none) is the character unchanged. */
export function withLevel(def: CharacterDef, level = 1): CharacterDef {
  return level > 1 ? { ...def, stats: statsAtLevel(def.stats, level) } : def;
}
