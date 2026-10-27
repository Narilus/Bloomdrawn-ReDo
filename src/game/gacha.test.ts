import { describe, expect, it } from 'vitest';
import type { BannerDef } from '../engine/index.ts';
import {
  chooseFocus,
  FOCUS_CHANCE,
  HARD_PITY,
  LOSSES_TO_GUARANTEE,
  POLLEN_PER_LOSS,
  POLLEN_PER_OVERFLOW,
  POLLEN_PER_PULL,
  pull,
  RATES,
  TEN_PULL,
  type PullRecord,
} from './gacha.ts';
import { NEW_PROFILE, type Profile } from './profile.ts';

// The gacha (docs/DESIGN.md, "Gacha"; docs/notes/m5-collection.md): one character banner with a Focus (owner, 28 Oct).

const BANNER: BannerDef = {
  id: 'banner.test',
  name: 'Test',
  pity: 'test',
  pool: ['a', 'b', 'c'],
  sr: { one: ['material.x', 'material.y'], amount: 1 },
  r: { 'memory.faint': 1, money: 100 },
};

/** A profile focused on `a`. */
const START: Profile = { ...NEW_PROFILE, focus: 'a' };
/** The profile one pull short of hard pity, so its next pull is an SSR. */
const ssrNext = (profile: Profile, gacha: Partial<NonNullable<Profile['gacha']>> = {}): Profile => ({
  ...profile,
  gacha: { stream: 1, losses: {}, history: [], ...profile.gacha, ...gacha, pity: { test: HARD_PITY - 1 } },
});

function pulled(profile: Profile, count: 1 | 10, seed = 1) {
  const result = pull(profile, BANNER, count, seed);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

/** The records of `times` pulls of `count` from one profile with Blooms to spare. */
function many(times: number, count: 1 | 10, seed = 1): PullRecord[] {
  let profile: Profile = { ...START, pulls: times * count };
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
    // About 520 are expected in 5,000 ten-pulls (simulated); this only shows the upgrade happens often.
    expect(history.filter((r) => r.guarantee === 'tenPull').length).toBeGreaterThan(400);
  });

  it('each pull spends one Purified Bloom and is audited: banner, pity and Blooms before and after, the result and what it gave', () => {
    const { profile, records } = pulled({ ...START, pulls: 12 }, 10);
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
    expect(pull({ ...START, pulls: 0 }, BANNER, 1, 1)).toEqual({ ok: false, reason: 'This needs 1 Purified Bloom.' });
    expect(pull({ ...START, pulls: 9 }, BANNER, 10, 1)).toEqual({ ok: false, reason: 'This needs 10 Purified Blooms.' });
  });

  it('an SSR gains the character, then dupe levels C1 to C5, then Pollen', () => {
    // Pity one short of the guarantee makes the next pull an SSR; a one-character banner makes it hers.
    const solo: BannerDef = { ...BANNER, pool: ['a'] };
    let profile: Profile = { ...START, pulls: 7 };
    const dupes: PullRecord['dupe'][] = [];
    for (let i = 0; i < 7; i++) {
      profile = ssrNext(profile);
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
    const start = { ...START, pulls: 20 };
    expect(pulled(start, 10, 5).records).toEqual(pulled(start, 10, 5).records);
    expect(pulled(start, 10, 5).records).not.toEqual(pulled(start, 10, 6).records);
    const once = pulled(start, 10, 5).profile;
    expect(pulled(once, 10, 5).records).toEqual(pulled(once, 10, 99).records);
  });

  it('pity and losses are kept per family, so another family starts from its own counts', () => {
    const { profile } = pulled({ ...START, pulls: 1, gacha: { stream: 1, pity: { other: 12 }, losses: { other: 2 }, history: [] } }, 1);
    expect([profile.gacha?.pity.other, profile.gacha?.losses.other]).toEqual([12, 2]);
    expect(profile.gacha?.history[0]).toMatchObject({ pityBefore: 0, lossesBefore: 0 });
  });
});

describe('the Focus and the 50/50', () => {
  const ssrs = many(100_000, 1).filter((r) => r.rarity === 'ssr');

  it('an SSR is the Focus half the time; a lost 50/50 is never the Focus, but another pool character, each as likely, with more Pollen', () => {
    const rolled = ssrs.filter((r) => r.fiftyFifty !== 'guaranteed');
    const lost = rolled.filter((r) => r.fiftyFifty === 'lost');
    expect(Math.abs(rolled.filter((r) => r.fiftyFifty === 'won').length / rolled.length - FOCUS_CHANCE)).toBeLessThan(0.03);
    expect(rolled.filter((r) => r.fiftyFifty === 'won').every((r) => r.character === 'a')).toBe(true);
    expect(lost.filter((r) => r.character === 'a')).toEqual([]);
    expect(Math.abs(lost.filter((r) => r.character === 'b').length / lost.length - 0.5)).toBeLessThan(0.05);
    for (const r of lost) expect(r.items.pollen).toBe(POLLEN_PER_PULL + POLLEN_PER_LOSS + (r.dupe === 'overflow' ? POLLEN_PER_OVERFLOW : 0));
    expect(ssrs.every((r) => r.focus === 'a')).toBe(true);
  });

  it('after two losses in a row the next SSR is the Focus, and getting her resets the count', () => {
    let guaranteed = 0;
    for (const r of ssrs) {
      expect(r.lossesBefore).toBeLessThanOrEqual(LOSSES_TO_GUARANTEE);
      if (r.lossesBefore === LOSSES_TO_GUARANTEE) {
        expect([r.fiftyFifty, r.character]).toEqual(['guaranteed', 'a']);
        guaranteed++;
      }
      expect(r.lossesAfter).toBe(r.character === 'a' ? 0 : r.lossesBefore + 1);
    }
    expect(guaranteed).toBeGreaterThan(200);
  });

  it('only an SSR changes the loss count', () => {
    for (const r of many(2_000, 1).filter((r) => r.rarity !== 'ssr')) expect(r.lossesAfter).toBe(r.lossesBefore);
  });

  it('changing the Focus keeps pity and the losses, so the guarantee earned on one is the next Focus', () => {
    const lostTwice = ssrNext({ ...START, pulls: 1 }, { losses: { test: 2 } });
    const switched = chooseFocus(lostTwice, BANNER, 'c');
    expect(switched.gacha).toEqual(lostTwice.gacha);
    const { records, profile } = pulled(switched, 1);
    expect(records[0]).toMatchObject({ character: 'c', focus: 'c', fiftyFifty: 'guaranteed', lossesBefore: 2, lossesAfter: 0 });
    expect(profile.gacha?.losses.test).toBe(0);
  });

  it('a pull needs a Focus from the pool', () => {
    expect(pull({ ...NEW_PROFILE, pulls: 5 }, BANNER, 1, 1)).toEqual({ ok: false, reason: 'Choose a Focus first.' });
    expect(pull({ ...NEW_PROFILE, pulls: 5, focus: 'z' }, BANNER, 1, 1)).toEqual({ ok: false, reason: 'Choose a Focus first.' });
    expect(() => chooseFocus(NEW_PROFILE, BANNER, 'z')).toThrow('not in the Test pool');
  });
});
