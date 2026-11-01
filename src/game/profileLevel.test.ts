import { describe, expect, it } from 'vitest';
import type { BannerDef } from '../engine/index.ts';
import { HARD_PITY, POLLEN_PER_OVERFLOW, pull, useSelector } from './gacha.ts';
import { NEW_PROFILE, type Profile } from './profile.ts';
import {
  claimLevels,
  expToNext,
  expToReach,
  gainExp,
  levelProgress,
  PROFILE_EXP,
  PROFILE_MAX,
  profileLevelOf,
  SSR_SELECTOR,
  unclaimed,
} from './profileLevel.ts';

// Profile level (docs/notes/m6-depth.md, "Profile level"; owner, 31 Oct). The numbers are placeholders.

const BANNER: BannerDef = { id: 'banner.test', name: 'Test', pity: 'test', pool: ['a', 'b'], sr: { one: ['material.x'], amount: 1 }, r: { money: 100 } };
const at = (level: number, extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, exp: expToReach(level), ...extra });

describe('the profile EXP curve', () => {
  it('100 EXP from level 1, each level a tenth more, rounded to 10', () => {
    expect([1, 2, 3, 4, 10, 49].map(expToNext)).toEqual([100, 110, 120, 130, 240, 9700]);
  });

  it('level 5 comes fast, 10 slower, 15 with more work, and 50 takes real time', () => {
    // A won run of five fights, two elites and its Boss gives 210.
    const run = 5 * PROFILE_EXP.fight + 2 * PROFILE_EXP.elite + PROFILE_EXP.boss;
    expect(run).toBe(210);
    expect([5, 10, 15, 25, 50].map((l) => Math.ceil(expToReach(l) / run))).toEqual([3, 7, 14, 43, 504]);
  });

  it('the level EXP reaches, capped at 50, with progress into it', () => {
    expect([undefined, 0, 99, 100, 209, 210].map(profileLevelOf)).toEqual([1, 1, 1, 2, 2, 3]);
    expect(profileLevelOf(expToReach(PROFILE_MAX) * 2)).toBe(PROFILE_MAX);
    expect(levelProgress(150)).toEqual({ level: 2, into: 50, need: 110 });
    expect(levelProgress(expToReach(PROFILE_MAX))).toEqual({ level: PROFILE_MAX, into: 0, need: 0 });
  });
});

describe('profile EXP sources', () => {
  it('fights, elites, Bosses, Trials, first Trial clears and SSR pulls each give their share; Memories never do', () => {
    expect(PROFILE_EXP).toEqual({ fight: 10, elite: 30, boss: 100, trial: 50, firstTrial: 200, ssr: 50 });
    expect(gainExp(gainExp(NEW_PROFILE, 'fight', 3), 'firstTrial').exp).toBe(230);
    expect(gainExp(NEW_PROFILE, 'elite', 0)).toBe(NEW_PROFILE);
  });

  it('every SSR pulled gives 50; other pulls give none', () => {
    const ssr = pull({ ...NEW_PROFILE, focus: 'a', gacha: { stream: 1, losses: {}, history: [], pity: { test: HARD_PITY - 1 } } }, BANNER, 1, 1);
    expect(ssr.ok && [ssr.records[0]!.rarity, ssr.profile.exp]).toEqual(['ssr', 50]);
    const plain = pull({ ...NEW_PROFILE, focus: 'a' }, BANNER, 10, 3);
    if (!plain.ok) throw new Error(plain.reason);
    expect(plain.profile.exp ?? 0).toBe(PROFILE_EXP.ssr * plain.records.filter((r) => r.rarity === 'ssr').length);
  });
});

describe('claiming level rewards', () => {
  it('each level past 1 gives a Purified Bloom, claimed all at once on the profile page', () => {
    expect(unclaimed(NEW_PROFILE)).toEqual([]);
    expect(claimLevels(NEW_PROFILE)).toEqual({ ok: false, reason: 'Nothing to claim yet.' });
    const four = at(4);
    expect(unclaimed(four)).toEqual([2, 3, 4]);
    const claimed = claimLevels(four);
    expect(claimed).toEqual({ ok: true, profile: { ...four, pulls: four.pulls + 3, claimed: 4 }, pulls: 3, selectors: 0 });
    if (!claimed.ok) return;
    expect(unclaimed(claimed.profile)).toEqual([]);
    expect(unclaimed({ ...claimed.profile, exp: expToReach(6) })).toEqual([5, 6]);
  });

  it('levels 25 and 50 also give an SSR selector', () => {
    const result = claimLevels(at(PROFILE_MAX, { claimed: 24 }));
    expect(result).toMatchObject({ ok: true, pulls: 26, selectors: 2, profile: { claimed: 50, items: { [SSR_SELECTOR]: 2 } } });
    expect(claimLevels(at(26, { claimed: 25 }))).toMatchObject({ selectors: 0 });
  });
});

describe('the SSR selector', () => {
  const holding = (extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, items: { [SSR_SELECTOR]: 1 }, ...extra });

  it('gives a chosen pool character as a pulled copy, and leaves pity, 50/50 losses and history alone', () => {
    const gacha = { stream: 9, pity: { test: 17 }, losses: { test: 1 }, history: [] };
    const result = useSelector(holding({ gacha }), BANNER, 'b');
    expect(result).toEqual({ ok: true, profile: { ...NEW_PROFILE, owned: ['b'], dupes: {}, items: {}, gacha }, dupe: 'new', pollen: 0 });
  });

  it('a character owned is a dupe level, and past C5 Pollen', () => {
    expect(useSelector(holding({ owned: ['b'] }), BANNER, 'b')).toMatchObject({ ok: true, dupe: 1, profile: { dupes: { b: 1 } } });
    const full = useSelector(holding({ owned: ['b'], dupes: { b: 5 } }), BANNER, 'b');
    expect(full).toMatchObject({ ok: true, dupe: 'overflow', pollen: POLLEN_PER_OVERFLOW, profile: { items: { pollen: POLLEN_PER_OVERFLOW } } });
  });

  it('needs a selector and a character from the banner, and gives no profile EXP', () => {
    expect(useSelector(NEW_PROFILE, BANNER, 'b')).toEqual({ ok: false, reason: 'No SSR selector to use.' });
    expect(useSelector(holding(), BANNER, 'agathe')).toEqual({ ok: false, reason: 'Choose a character from the banner.' });
    const two = useSelector(holding({ items: { [SSR_SELECTOR]: 2 } }), BANNER, 'a');
    expect(two.ok && [two.profile.items, two.profile.exp]).toEqual([{ [SSR_SELECTOR]: 1 }, undefined]);
  });
});
