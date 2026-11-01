import { gainExp } from './profileLevel.ts';
import type { Profile } from './profile.ts';

// Trials (docs/notes/m6-depth.md, "Trials"; owner, 31 Oct): one boss per Domain, fought straight,
// with no map, in five tiers at levels 10 to 50. A win pays the Domain's ascension material, enough
// to ascend one character at the tier's level (Tier 5, two), and a tier's first clear gives Purified
// Blooms and opens the next tier. Attempts are unlimited and a defeat pays nothing. Pure.

export interface TrialTier {
  tier: number;
  /** The boss's level. */
  level: number;
  /** The Domain's material a win pays. */
  pay: number;
  /** Purified Blooms for the tier's first clear. */
  firstClear: number;
}

/** Tier 4 pays 3, the most an ascension takes, since none waits at 40 (my reading, m6-depth.md). */
export const TRIAL_TIERS: readonly TrialTier[] = [
  { tier: 1, level: 10, pay: 1, firstClear: 1 },
  { tier: 2, level: 20, pay: 2, firstClear: 1 },
  { tier: 3, level: 30, pay: 3, firstClear: 1 },
  { tier: 4, level: 40, pay: 3, firstClear: 1 },
  { tier: 5, level: 50, pay: 6, firstClear: 3 },
];

/** The highest tier of a Domain's Trial the profile has won; 0 is none. */
export const trialCleared = (profile: Profile, domain: string) => profile.trials?.[domain] ?? 0;

/** The highest tier the profile may attempt: the one after its best, up to 5. */
export const trialOpen = (profile: Profile, domain: string) => Math.min(TRIAL_TIERS.length, trialCleared(profile, domain) + 1);

export type TrialResult =
  | { ok: true; profile: Profile; won: boolean; material: number; pulls: number; first: boolean }
  | { ok: false; reason: string };

/**
 * The profile after a Trial fight at `tier` ends. A win pays the tier's material and counts in the
 * stats with its profile EXP; a first clear also gives its Blooms and first-clear EXP and opens the
 * next tier. A defeat changes nothing. A tier not yet open is refused.
 */
export function endTrial(profile: Profile, domain: string, material: string, tier: number, won: boolean): TrialResult {
  const def = TRIAL_TIERS[tier - 1];
  if (!def) return { ok: false, reason: `There is no Tier ${tier}.` };
  if (tier > trialOpen(profile, domain)) return { ok: false, reason: `Win Tier ${tier - 1} first.` };
  if (!won) return { ok: true, profile, won, material: 0, pulls: 0, first: false };
  const first = tier > trialCleared(profile, domain);
  let after: Profile = {
    ...profile,
    items: { ...profile.items, [material]: (profile.items?.[material] ?? 0) + def.pay },
    stats: { ...profile.stats, trials: (profile.stats?.trials ?? 0) + 1 },
  };
  after = gainExp(after, 'trial');
  if (first) after = gainExp({ ...after, pulls: after.pulls + def.firstClear, trials: { ...profile.trials, [domain]: tier } }, 'firstTrial');
  return { ok: true, profile: after, won, material: def.pay, pulls: first ? def.firstClear : 0, first };
}
