import { describe, expect, it } from 'vitest';
import { MAX_DUPES } from './gacha.ts';
import { NEW_PROFILE, ownedCharacters, type Profile } from './profile.ts';
import { buyDupe, DUPE_PRICE } from './shop.ts';

// The Profile Shop (docs/notes/m6-depth.md; owner, 31 Oct): character dupes for 100 Pollen, the
// starters' included.

const STARTERS = ['starter'];
const profile = (extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, owned: ['pulled'], items: { pollen: 250, money: 40 }, ...extra });
const owned = (p: Profile) => ownedCharacters(p, STARTERS);

describe('buying a dupe', () => {
  it('raises Potential a level for 100 Pollen, leaving everything else as it was', () => {
    const before = profile({ dupes: { pulled: 2 } });
    const result = buyDupe(before, 'pulled', owned(before), 5);
    if (!result.ok) throw new Error(result.reason);
    expect(DUPE_PRICE).toBe(100);
    expect(result.level).toBe(3);
    expect(result.profile).toEqual({ ...before, items: { pollen: 150, money: 40 }, dupes: { pulled: 3 } });
  });

  it("sells the starters' dupes, though no banner has them", () => {
    const before = profile();
    const result = buyDupe(before, 'starter', owned(before), 5);
    if (!result.ok) throw new Error(result.reason);
    expect(result.profile.dupes).toEqual({ starter: 1 });
    expect(result.profile.owned).toEqual(['pulled']);
  });

  it('can be bought again while the Pollen lasts', () => {
    let p = profile();
    for (const level of [1, 2]) {
      const result = buyDupe(p, 'pulled', owned(p), 5);
      if (!result.ok) throw new Error(result.reason);
      expect(result.level).toBe(level);
      p = result.profile;
    }
    expect(p.items?.pollen).toBe(50);
    expect(buyDupe(p, 'pulled', owned(p), 5)).toEqual({ ok: false, reason: 'A dupe costs 100 Pollen; you have 50.' });
  });

  it('spends exactly the price, down to none', () => {
    const before = profile({ items: { pollen: DUPE_PRICE } });
    const result = buyDupe(before, 'pulled', owned(before), 5);
    if (!result.ok) throw new Error(result.reason);
    expect(result.profile.items).toEqual({ pollen: 0 });
  });

  it('refuses a character not owned, and changes nothing', () => {
    const before = profile();
    expect(buyDupe(before, 'stranger', owned(before), 5)).toEqual({ ok: false, reason: 'Only characters you own have dupes for sale.' });
  });

  it('refuses past the last Potential level', () => {
    const before = profile({ dupes: { pulled: MAX_DUPES } });
    expect(buyDupe(before, 'pulled', owned(before), 5)).toEqual({ ok: false, reason: `She is already at P${MAX_DUPES}.` });
  });

  it('refuses a character with fewer or no Potential levels past her last', () => {
    const before = profile({ dupes: { pulled: 2 } });
    expect(buyDupe(before, 'pulled', owned(before), 2)).toEqual({ ok: false, reason: 'She is already at P2.' });
    expect(buyDupe(before, 'starter', owned(before), 0)).toEqual({ ok: false, reason: 'She has no Potential levels yet.' });
  });

  it('refuses a purse short of Pollen, or without any', () => {
    const short = profile({ items: { pollen: DUPE_PRICE - 1 } });
    expect(buyDupe(short, 'pulled', owned(short), 5)).toEqual({ ok: false, reason: 'A dupe costs 100 Pollen; you have 99.' });
    const none = profile({ items: {} });
    expect(buyDupe(none, 'pulled', owned(none), 5)).toEqual({ ok: false, reason: 'A dupe costs 100 Pollen; you have 0.' });
  });
});
