import type { Profile } from './profile.ts';

// Depth tiers (docs/notes/m6-depth.md, "Depth tiers"; owner, 31 Oct). A run's depth sets its enemies'
// level, and its Memories and Ducats grow with it. A new profile's first run is at Depth 1; after it,
// Depths 1–10 are open, and winning the last depth of a band of ten opens the next band.

export const DEPTH_MAX = 50;
export const DEPTH_BAND = 10;
/** What each depth past 1 adds to the Memories and Ducats a run banks, as a share of Depth 1's (placeholder, from `npm run lab:depth`). */
export const REWARD_PER_DEPTH = 0.25;

/** The deepest depth the profile can choose. */
export function depthOpen(profile: Profile): number {
  if (profile.runs === 0) return 1;
  const bands = Math.floor((profile.deepest ?? 0) / DEPTH_BAND) + 1;
  return Math.min(DEPTH_MAX, bands * DEPTH_BAND);
}

/** The depth party select opens on: the last one chosen, if it is still open, else the deepest open. */
export const depthOf = (profile: Profile): number => Math.min(profile.depth ?? 1, depthOpen(profile));

/** What a depth multiplies a run's Memories and Ducats by. */
export const rewardMultiplier = (depth: number): number => 1 + REWARD_PER_DEPTH * (Math.max(1, depth) - 1);

/** Keeps the depth chosen for the next run; a depth not open is refused. */
export function chooseDepth(profile: Profile, depth: number): { ok: true; profile: Profile } | { ok: false; reason: string } {
  const open = depthOpen(profile);
  if (!Number.isInteger(depth) || depth < 1) return { ok: false, reason: 'Choose a depth from 1.' };
  if (depth > open) return { ok: false, reason: open === 1 ? 'The first expedition is at Depth 1.' : `Win Depth ${open} to go deeper.` };
  return { ok: true, profile: { ...profile, depth } };
}
