import { describe, expect, it } from 'vitest';
import { chooseDepth, depthOf, depthOpen, rewardMultiplier } from './depth.ts';
import { NEW_PROFILE } from './profile.ts';

// Depth tiers (M6.4; owner, 31 Oct): a new profile's first run is Depth 1; after it, 1–10 are open,
// and winning Depth 10 opens 11–20, winning 20 opens 21–30, and so on to 50.

const played = { ...NEW_PROFILE, runs: 1 };

describe('depths', () => {
  it('a new profile has only Depth 1; after any run, Depths 1 to 10', () => {
    expect(depthOpen(NEW_PROFILE)).toBe(1);
    expect(depthOpen(played)).toBe(10);
  });

  it('winning the last depth of a band opens the next band, up to 50', () => {
    expect([9, 10, 15, 19, 20, 30, 39, 40, 50].map((deepest) => depthOpen({ ...played, deepest }))).toEqual([10, 20, 20, 20, 30, 40, 40, 50, 50]);
  });

  it('a depth is chosen only if open, and party select opens on the last one chosen while it is', () => {
    expect(chooseDepth(NEW_PROFILE, 2)).toEqual({ ok: false, reason: 'The first expedition is at Depth 1.' });
    expect(chooseDepth(played, 11)).toEqual({ ok: false, reason: 'Win Depth 10 to go deeper.' });
    expect(chooseDepth(played, 0)).toMatchObject({ ok: false });
    expect(chooseDepth(played, 2.5)).toMatchObject({ ok: false });
    const chosen = chooseDepth(played, 7);
    if (!chosen.ok) throw new Error(chosen.reason);
    expect(chosen.profile.depth).toBe(7);
    expect(depthOf(chosen.profile)).toBe(7);
    expect(depthOf(NEW_PROFILE)).toBe(1);
    // A depth chosen and no longer open (a profile loaded from elsewhere) falls back to the deepest open.
    expect(depthOf({ ...played, depth: 30 })).toBe(10);
  });

  it("each depth past 1 adds a quarter of Depth 1's Memories and Ducats", () => {
    expect([1, 2, 10, 40, 50].map(rewardMultiplier)).toEqual([1, 1.25, 3.25, 10.75, 13.25]);
  });
});
