import { describe, expect, it } from 'vitest';
import type { BannerDef } from '../engine/index.ts';
import { HARD_PITY, POLLEN_PER_OVERFLOW, POLLEN_PER_PULL, pull, RATES, TEN_PULL, type PullRecord } from './gacha.ts';
import { NEW_PROFILE, type Profile } from './profile.ts';

// The gacha (docs/DESIGN.md, "Gacha"; docs/notes/m5-collection.md).

const BANNER: BannerDef = {
  id: 'banner.test',
  name: 'Test',
  pity: 'test',
  ssr: ['a', 'b'],
  sr: { one: ['material.x', 'material.y'], amount: 1 },
  r: { 'memory.faint': 1, money: 100 },
};

function pulled(profile: Profile, count: 1 | 10, seed = 1) {
  const result = pull(profile, BANNER, count, seed);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

/** The records of `times` pulls of `count` from one profile with Blooms to spare. */
function many(times: number, count: 1 | 10, seed = 1): PullRecord[] {
  let profile: Profile = { ...NEW_PROFILE, pulls: times * count };
  const all: PullRecord[] = [];
  for (let i = 0; i < times; i++) {
    const result = pulled(profile, count, seed);
    all.push(...result.records);
    // The history is copied on every pull; keep it short so many pulls stay quick.
    profile = { ...result.profile, gacha: { ...result.profile.gacha!, history: [] } };
  }
  return all;
}

describe('the gacha', () => {
  it('pulls at SSR 3%, SR 15% and R 82%, wherever no guarantee decides it', () => {
    const free = many(100_000, 1).filter((r) => !r.guarantee);
    const share = (rarity: string) => free.filter((r) => r.rarity === rarity).length / free.length;
    expect(Math.abs(share('ssr') - RATES.ssr)).toBeLessThan(0.002);
    expect(Math.abs(share('sr') - RATES.sr)).toBeLessThan(0.004);
    expect(Math.abs(share('r') - RATES.r)).toBeLessThan(0.004);
  });

  it('an SSR comes by pull 30 every time, and the counter resets on every SSR', () => {
    for (const seed of [1, 2, 3]) {
      const history = many(20_000, 1, seed);
      let since = 0;
      let forced = 0;
      for (const r of history) {
        since++;
        expect(r.pityBefore).toBe(since - 1);
        if (r.rarity !== 'ssr') continue;
        expect(since).toBeLessThanOrEqual(HARD_PITY);
        if (r.guarantee === 'pity') {
          expect(since).toBe(HARD_PITY);
          forced++;
        }
        expect(r.pityAfter).toBe(0);
        since = 0;
      }
      // At a flat 3%, about 40% of SSRs wait for pity.
      expect(forced).toBeGreaterThan(100);
    }
  });

  it('every ten-pull has an SR or better, its tenth upgraded only when the nine before were all R', () => {
    const history = many(5_000, 10);
    for (let i = 0; i < history.length; i += TEN_PULL) {
      const ten = history.slice(i, i + TEN_PULL);
      expect(ten.some((r) => r.rarity !== 'r')).toBe(true);
      const upgraded = ten.filter((r) => r.guarantee === 'tenPull');
      if (upgraded.length) expect([upgraded[0], ten.slice(0, 9).every((r) => r.rarity === 'r')]).toEqual([ten[9], true]);
    }
    expect(history.filter((r) => r.guarantee === 'tenPull').length).toBeGreaterThan(500);
  });

  it('each pull spends one Purified Bloom and is audited: banner, pity and Blooms before and after, the result and what it gave', () => {
    const { profile, records } = pulled({ ...NEW_PROFILE, pulls: 12 }, 10);
    expect(profile.pulls).toBe(2);
    expect(records.map((r) => [r.n, r.banner, r.bloomsBefore, r.bloomsAfter])).toEqual(
      Array.from({ length: 10 }, (_, i) => [i + 1, 'banner.test', 12 - i, 11 - i]),
    );
    expect(profile.gacha?.history).toEqual(records);
    for (const r of records) {
      expect(r.pityAfter).toBe(r.rarity === 'ssr' ? 0 : r.pityBefore + 1);
      if (r.rarity === 'r') expect(r.items).toEqual({ pollen: POLLEN_PER_PULL, 'memory.faint': 1, money: 100 });
      if (r.rarity === 'sr') expect(Object.keys(r.items).filter((k) => k !== 'pollen').map((k) => [k, r.items[k]])).toEqual([[expect.stringMatching(/^material\.[xy]$/), 1]]);
    }
    // The profile's items are the sum of what the pulls gave.
    const sum: Record<string, number> = {};
    for (const r of records) for (const [k, n] of Object.entries(r.items)) sum[k] = (sum[k] ?? 0) + n;
    expect(profile.items).toEqual(sum);
    expect(profile.items?.pollen).toBe(10 * POLLEN_PER_PULL);
  });

  it('a pull without the Blooms for it is rejected and changes nothing', () => {
    expect(pull({ ...NEW_PROFILE, pulls: 0 }, BANNER, 1, 1)).toEqual({ ok: false, reason: 'This needs 1 Purified Bloom.' });
    expect(pull({ ...NEW_PROFILE, pulls: 9 }, BANNER, 10, 1)).toEqual({ ok: false, reason: 'This needs 10 Purified Blooms.' });
  });

  it('an SSR gains the character, then dupe levels C1 to C5, then Pollen', () => {
    // Pity one short of the guarantee makes the next pull an SSR; a one-character banner makes it hers.
    const solo: BannerDef = { ...BANNER, ssr: ['a'] };
    let profile: Profile = { ...NEW_PROFILE, pulls: 7 };
    const dupes: PullRecord['dupe'][] = [];
    for (let i = 0; i < 7; i++) {
      profile = { ...profile, gacha: { ...(profile.gacha ?? { stream: 1, history: [] }), pity: { test: HARD_PITY - 1 } } };
      const result = pull(profile, solo, 1, 1);
      if (!result.ok) throw new Error(result.reason);
      profile = result.profile;
      dupes.push(result.records[0]!.dupe);
      expect(result.records[0]).toMatchObject({ rarity: 'ssr', character: 'a', guarantee: 'pity', pityBefore: HARD_PITY - 1, pityAfter: 0 });
    }
    expect(dupes).toEqual(['new', 1, 2, 3, 4, 5, 'overflow']);
    expect([profile.owned, profile.dupes]).toEqual([['a'], { a: 5 }]);
    expect(profile.items?.pollen).toBe(7 * POLLEN_PER_PULL + POLLEN_PER_OVERFLOW);
  });

  it('is seeded: the same seed pulls the same, and the stream then lives in the profile', () => {
    const start = { ...NEW_PROFILE, pulls: 20 };
    expect(pulled(start, 10, 5).records).toEqual(pulled(start, 10, 5).records);
    expect(pulled(start, 10, 5).records).not.toEqual(pulled(start, 10, 6).records);
    const once = pulled(start, 10, 5).profile;
    expect(pulled(once, 10, 5).records).toEqual(pulled(once, 10, 99).records);
  });

  it('pity is kept per family, so another family starts from its own count', () => {
    const { profile } = pulled({ ...NEW_PROFILE, pulls: 1, gacha: { stream: 1, pity: { other: 12 }, history: [] } }, 1);
    expect(profile.gacha?.pity).toMatchObject({ other: 12 });
    expect(profile.gacha?.history[0]?.pityBefore).toBe(0);
  });
});
