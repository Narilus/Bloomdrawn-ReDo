import type { Profile } from './profile.ts';

// Profile level (docs/notes/m6-depth.md, "Profile level"; owner, 31 Oct). Earned by play, never by
// Memories: fights, elites, Bosses, Trials, first Trial clears and SSR pulls. Levels 1 to 50 on an
// exponential curve. Each level past 1 gives a Purified Bloom, claimed on the profile page, and
// levels 25 and 50 give an SSR selector too. Profile levels 5, 10 and 15 allow the ascensions at
// 10, 20 and 30 (`levels.ts`). The numbers are placeholders the owner tunes. Pure.

export const PROFILE_MAX = 50;

/** Profile EXP each kind of play gives (placeholders). A won run of five fights, two elites and its Boss gives 210. */
export const PROFILE_EXP = { fight: 10, elite: 30, boss: 100, trial: 50, firstTrial: 200, ssr: 50 } as const;
export type ExpSource = keyof typeof PROFILE_EXP;

/** EXP from level `level` to the next: 100 at level 1, growing a tenth a level, rounded to 10. */
export const expToNext = (level: number) => Math.round((100 * 1.1 ** (level - 1)) / 10) * 10;

/** EXP from level 1 to reach `level`. */
export const expToReach = (level: number) => Array.from({ length: Math.max(0, level - 1) }, (_, i) => expToNext(i + 1)).reduce((a, b) => a + b, 0);

/** The profile level `exp` reaches, up to 50. */
export function profileLevelOf(exp = 0): number {
  let level = 1;
  while (level < PROFILE_MAX && exp >= expToReach(level + 1)) level++;
  return level;
}

/** Progress toward the next level: EXP into this one and the EXP it needs (none at 50). */
export function levelProgress(exp = 0): { level: number; into: number; need: number } {
  const level = profileLevelOf(exp);
  if (level >= PROFILE_MAX) return { level, into: 0, need: 0 };
  return { level, into: exp - expToReach(level), need: expToNext(level) };
}

/** The profile with EXP for `count` of a source added. */
export const gainExp = (profile: Profile, source: ExpSource, count = 1): Profile =>
  count > 0 ? { ...profile, exp: (profile.exp ?? 0) + PROFILE_EXP[source] * count } : profile;

/** The item levels 25 and 50 give: a chosen SSR, outside pity (owner, 31 Oct). */
export const SSR_SELECTOR = 'selector.ssr';
export const SELECTOR_LEVELS: readonly number[] = [25, 50];

/** The levels reached whose rewards are still to claim, oldest first. */
export function unclaimed(profile: Profile): number[] {
  const level = profileLevelOf(profile.exp);
  return Array.from({ length: Math.max(0, level - (profile.claimed ?? 1)) }, (_, i) => (profile.claimed ?? 1) + i + 1);
}

export type ClaimResult = { ok: true; profile: Profile; pulls: number; selectors: number } | { ok: false; reason: string };

/** Claims every level's reward still to claim: a Purified Bloom each, and a selector at 25 and 50. */
export function claimLevels(profile: Profile): ClaimResult {
  const levels = unclaimed(profile);
  if (levels.length === 0) return { ok: false, reason: 'Nothing to claim yet.' };
  const selectors = levels.filter((l) => SELECTOR_LEVELS.includes(l)).length;
  const items = selectors > 0 ? { items: { ...profile.items, [SSR_SELECTOR]: (profile.items?.[SSR_SELECTOR] ?? 0) + selectors } } : {};
  return { ok: true, profile: { ...profile, ...items, pulls: profile.pulls + levels.length, claimed: levels.at(-1)! }, pulls: levels.length, selectors };
}
