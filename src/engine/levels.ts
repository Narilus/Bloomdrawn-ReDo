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

/**
 * Enemies by level (owner, 31 Oct: a depth fields enemies at its own level; docs/notes/m6-depth.md).
 * Placeholders from the depth model (`npm run lab:depth`): HP, Shield and heals follow the party's
 * damage, and damage follows the party's HP, each a straight line to ENEMY_CURVE_TOP as a share of
 * level 1. Past it, characters stop levelling, and both rise PAST_TOP of that level's numbers a level.
 */
export const ENEMY_LEVEL_GROWTH = { hp: 0.0032, damage: 0.0251 };
export const ENEMY_CURVE_TOP = 40;
export const PAST_TOP = 0.03;

/** An enemy's HP and its damage at a level, in thousandths of level 1's; level 1 (or none) is 1000. */
export function enemyLevelScale(level = 1): { hp: number; damage: number } {
  const on = Math.min(level, ENEMY_CURVE_TOP) - 1;
  const past = 1 + PAST_TOP * Math.max(0, level - ENEMY_CURVE_TOP);
  const at = (growth: number) => Math.round(1000 * (1 + growth * Math.max(0, on)) * past);
  return { hp: at(ENEMY_LEVEL_GROWTH.hp), damage: at(ENEMY_LEVEL_GROWTH.damage) };
}

/** A number at an enemy level's scale, rounded down: `byLevel(40, enemyLevelScale(40).hp)`. */
export const byLevel = (n: number, thousandths: number): number => (thousandths === 1000 ? n : Math.floor((n * thousandths) / 1000));
