import type { CharacterDef, Role, Stats } from './defs.ts';

// Character growth (docs/notes/m6-scaling.md, 4.4–4.6; owner, 31 Oct): stats grow a lot, by role,
// and card numbers are ratios of them, so every source of a stat feeds every card. About 70% of the
// growth comes from levels, spread evenly from 1 to 40, and about 30% from the three ascensions,
// 10% each when she ascends. Level 1 with no ascension is the character as written. Base is her
// stats at her dupe level, so C2's stats grow too. Multipliers are placeholders for the lab.

/** Each role's stats at level 40 with every ascension made, as multiples of base; Attackers also gain crit per ascension. */
export const ROLES: Record<Role, { hp: number; attack: number; defense: number; critRate: number; critDamage: number }> = {
  attacker: { hp: 6, attack: 9, defense: 5, critRate: 5, critDamage: 10 },
  sentinel: { hp: 9, attack: 5, defense: 9, critRate: 0, critDamage: 0 },
  support: { hp: 8, attack: 6, defense: 7, critRate: 0, critDamage: 0 },
  hybrid: { hp: 7, attack: 7.5, defense: 7, critRate: 0, critDamage: 0 },
};
/** The share of growth levels give, spread from level 1 to GROWTH_TOP, and the share each ascension gives. */
export const LEVEL_SHARE = 0.7;
export const ASCENSION_SHARE = 0.1;
export const GROWTH_TOP = 40;
/** Every character's crit before growth: a 5% chance, and a crit deals 150% (owner, 31 Oct). */
export const BASE_CRIT = { rate: 5, damage: 50 };
export const CRIT_RATE_MAX = 100;

/** A character's crit chance and crit damage bonus, in percent. */
export const critOf = (stats: Stats): { rate: number; damage: number } => ({
  rate: Math.min(CRIT_RATE_MAX, stats.critRate ?? BASE_CRIT.rate),
  damage: stats.critDamage ?? BASE_CRIT.damage,
});

/**
 * Stats at a level and number of ascensions: `base × (1 + (M − 1) × (0.7 × (level − 1) / 39 + 0.1 × ascensions))`,
 * each rounded, with M the role's multiplier; crit rate and damage rise by the role's amount per ascension.
 */
export function statsAt(stats: Stats, role: Role = 'hybrid', level = 1, ascensions = 0): Stats {
  if (level <= 1 && ascensions <= 0) return stats;
  const r = ROLES[role];
  const share = (LEVEL_SHARE * (Math.min(level, GROWTH_TOP) - 1)) / (GROWTH_TOP - 1) + ASCENSION_SHARE * ascensions;
  const grow = (n: number, m: number) => Math.round(n * (1 + (m - 1) * share));
  const crit = critOf(stats);
  return {
    hp: grow(stats.hp, r.hp),
    attack: grow(stats.attack, r.attack),
    defense: grow(stats.defense, r.defense),
    ...(r.critRate * ascensions > 0 || stats.critRate !== undefined ? { critRate: Math.min(CRIT_RATE_MAX, crit.rate + r.critRate * ascensions) } : {}),
    ...(r.critDamage * ascensions > 0 || stats.critDamage !== undefined ? { critDamage: crit.damage + r.critDamage * ascensions } : {}),
  };
}

/** The character at a level and number of ascensions; level 1 with none (or neither given) is the character unchanged. */
export function withGrowth(def: CharacterDef, level = 1, ascensions = 0): CharacterDef {
  return level > 1 || ascensions > 0 ? { ...def, stats: statsAt(def.stats, def.role, level, ascensions) } : def;
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
