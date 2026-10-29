import type { Registry } from '../engine/index.ts';
import type { Profile } from './profile.ts';

// Levels, Memories and ascension (docs/DESIGN.md, "RPG layer"; docs/notes/m5-collection.md; owner,
// 29 Oct, placeholders). Levels 1 to 40. The next level costs 100 × the current level in EXP and
// 20 × it in Ducats. Memories pay the EXP, the smallest first; a bigger one spent on a cheap level
// refunds the excess as smaller ones. At 10, 20 and 30 a character takes no EXP until she ascends,
// which costs her Domain's material plus Ducats. Pure, like the rest of the profile.

export const MAX_LEVEL = 40;
export const MONEY = 'money';
/** Memories by item, smallest first, with the EXP each is worth. */
export const MEMORIES: readonly { item: string; exp: number }[] = [
  { item: 'memory.faint', exp: 100 },
  { item: 'memory.clear', exp: 500 },
  { item: 'memory.vivid', exp: 2000 },
];
/** The ascensions in order: the level each gates, and its cost in the Domain's material and in Ducats. */
export const ASCENSIONS: readonly { at: number; materials: number; money: number }[] = [
  { at: 10, materials: 1, money: 1000 },
  { at: 20, materials: 2, money: 3000 },
  { at: 30, materials: 3, money: 6000 },
];

export const expToNext = (level: number) => 100 * level;
export const moneyToNext = (level: number) => 20 * level;

/** A character's level; one never levelled is level 1. */
export const levelOf = (profile: Profile, id: string) => profile.levels?.[id] ?? 1;
/** Ascensions a character has made, 0 to 3. */
export const ascensionsOf = (profile: Profile, id: string) => profile.ascensions?.[id] ?? 0;
/** The level she can't pass until her next ascension, or the last level. */
export const levelCap = (ascensions: number) => ASCENSIONS[ascensions]?.at ?? MAX_LEVEL;

/** The EXP the profile's Memories are worth in all. */
export const memoryExp = (items: Readonly<Record<string, number>> = {}) => MEMORIES.reduce((sum, m) => sum + (items[m.item] ?? 0) * m.exp, 0);

/**
 * Items after paying `exp` in Memories, or undefined if they can't. The smallest are spent first,
 * then as many of the next as cover the rest; what the last overpays comes back as smaller Memories.
 */
export function payExp(items: Readonly<Record<string, number>>, exp: number): Record<string, number> | undefined {
  const out = { ...items };
  let due = exp;
  for (const { item, exp: worth } of MEMORIES) {
    if (due <= 0) break;
    const spent = Math.min(out[item] ?? 0, Math.ceil(due / worth));
    out[item] = (out[item] ?? 0) - spent;
    due -= spent * worth;
  }
  if (due > 0) return undefined;
  let refund = -due;
  for (const { item, exp: worth } of [...MEMORIES].reverse()) {
    const back = Math.floor(refund / worth);
    if (back > 0) out[item] = (out[item] ?? 0) + back;
    refund -= back * worth;
  }
  return out;
}

export type GrowthResult = { ok: true; profile: Profile; level: number; change: Record<string, number> } | { ok: false; reason: string };

/** Each item's change between two item tables, leaving out what didn't change. */
function changeOf(before: Readonly<Record<string, number>>, after: Readonly<Record<string, number>>): Record<string, number> {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries([...ids].map((id) => [id, (after[id] ?? 0) - (before[id] ?? 0)]).filter(([, n]) => n !== 0));
}
const withoutEmpty = (items: Record<string, number>) => Object.fromEntries(Object.entries(items).filter(([, n]) => n > 0));

/** What `levels` levels from `from` cost: EXP (paid in Memories) and Ducats. */
export function levelCost(from: number, levels: number): { exp: number; money: number } {
  let exp = 0;
  let money = 0;
  for (let level = from; level < from + levels; level++) {
    exp += expToNext(level);
    money += moneyToNext(level);
  }
  return { exp, money };
}

/** Raises a character `levels` levels, paying for all of them, or refuses and changes nothing. */
export function levelUp(profile: Profile, id: string, levels: number): GrowthResult {
  const from = levelOf(profile, id);
  const cap = levelCap(ascensionsOf(profile, id));
  if (!Number.isInteger(levels) || levels < 1) return { ok: false, reason: 'Choose at least one level.' };
  if (from >= MAX_LEVEL) return { ok: false, reason: `Level ${MAX_LEVEL} is the highest.` };
  if (from + levels > cap) return { ok: false, reason: `Level ${cap} needs an ascension first.` };
  const { exp, money } = levelCost(from, levels);
  const before = profile.items ?? {};
  const paid = payExp(before, exp);
  if (!paid) return { ok: false, reason: `This needs ${exp} EXP in Memories.` };
  if ((paid[MONEY] ?? 0) < money) return { ok: false, reason: `This needs ${money} Ducats.` };
  paid[MONEY] = (paid[MONEY] ?? 0) - money;
  const level = from + levels;
  return {
    ok: true,
    profile: { ...profile, items: withoutEmpty(paid), levels: { ...profile.levels, [id]: level } },
    level,
    change: changeOf(before, paid),
  };
}

/** The most levels the profile can pay for now, up to her next ascension or the last level. */
export function affordableLevels(profile: Profile, id: string): number {
  const room = levelCap(ascensionsOf(profile, id)) - levelOf(profile, id);
  let n = 0;
  while (n < room && levelUp(profile, id, n + 1).ok) n++;
  return n;
}

/** Her Domain's ascension material, if it has one. */
export const materialOf = (id: string, registry: Registry) => registry.domains[registry.characters[id]?.domain ?? '']?.material;

/** What her next ascension costs, by item, or undefined if she has none left. */
export function ascensionCost(profile: Profile, id: string, registry: Registry): Record<string, number> | undefined {
  const next = ASCENSIONS[ascensionsOf(profile, id)];
  const material = materialOf(id, registry);
  if (!next || !material) return undefined;
  return { [material]: next.materials, [MONEY]: next.money };
}

/** Ascends a character at her level cap, paying her Domain's material and Ducats, or refuses and changes nothing. */
export function ascend(profile: Profile, id: string, registry: Registry): GrowthResult {
  const ascensions = ascensionsOf(profile, id);
  const cost = ascensionCost(profile, id, registry);
  if (!cost) return { ok: false, reason: ascensions >= ASCENSIONS.length ? 'Every ascension is made.' : 'Her Domain has no ascension material.' };
  const level = levelOf(profile, id);
  if (level < levelCap(ascensions)) return { ok: false, reason: `Ascension needs level ${levelCap(ascensions)}.` };
  const before = profile.items ?? {};
  const short = Object.entries(cost).find(([item, n]) => (before[item] ?? 0) < n);
  if (short) return { ok: false, reason: 'This needs more than the profile has.' };
  const after = { ...before };
  for (const [item, n] of Object.entries(cost)) after[item] = (after[item] ?? 0) - n;
  return {
    ok: true,
    profile: { ...profile, items: withoutEmpty(after), ascensions: { ...profile.ascensions, [id]: ascensions + 1 } },
    level,
    change: changeOf(before, after),
  };
}
