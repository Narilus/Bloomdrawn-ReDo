import { describe, expect, it } from 'vitest';
import type { BannerDef, Registry, WeaponDef } from '../engine/index.ts';
import { HARD_PITY, POLLEN_PER_PULL, pull, type PullRecord } from './gacha.ts';
import { NEW_PROFILE, type Profile } from './profile.ts';
import { equip, receiveWeapon, reinforce, SALVAGE, salvage, setWeaponSettings, toggleLock, unequip, wieldedBy, type WeaponCopy } from './weapons.ts';

// Owned weapons (docs/notes/weapons.md; owner, 14 Nov): copies, one wielder each, reinforced +0 to
// +5 by duplicates or salvaged for Pollen; the banners' two tickboxes; the weapon banner.

const SCALPEL = 'w.sr1';
const HOOK = 'w.r1';
const STAFF = 'w.ssr1';
const def = (id: string, rarity: WeaponDef['rarity']): WeaponDef => ({ id, name: id, rarity, main: { stat: 'attack', amount: 10 }, steps: [] });
const registry = { weapons: Object.fromEntries([def(STAFF, 'ssr'), def('w.ssr2', 'ssr'), def(SCALPEL, 'sr'), def('w.sr2', 'sr'), def(HOOK, 'r')].map((w) => [w.id, w])) } as unknown as Registry;
const items = { 'memory.faint': 1, money: 100 };
const CHARACTER_BANNER: BannerDef = { id: 'banner.c', name: 'C', kind: 'character', pity: 'character', pool: ['a', 'b'], sr: [SCALPEL, 'w.sr2'], r: { weapons: [HOOK], chance: 0.5, items } };
const WEAPON_BANNER: BannerDef = { id: 'banner.weapon', name: 'W', kind: 'weapon', pity: 'weapon', pool: [STAFF, 'w.ssr2'], sr: [SCALPEL, 'w.sr2'], r: { weapons: [HOOK], chance: 0.5, items } };
const owning = (weapons: WeaponCopy[], extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, weapons, ...extra });
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason);
  return (r as unknown as { profile: Profile }).profile;
};

describe('a pulled copy', () => {
  it('is new the first time, and kept as a spare with both tickboxes off', () => {
    const first = receiveWeapon(NEW_PROFILE, SCALPEL, 'sr');
    expect(first).toEqual({ profile: owning([{ uid: 'w1', weapon: SCALPEL }]), outcome: 'new', pollen: 0 });
    const second = receiveWeapon(first.profile, SCALPEL, 'sr');
    expect([second.outcome, second.profile.weapons]).toEqual(['kept', [{ uid: 'w1', weapon: SCALPEL }, { uid: 'w2', weapon: SCALPEL }]]);
  });

  it('auto-reinforces a copy below +5: the wielded one first, then the highest', () => {
    const copies: WeaponCopy[] = [{ uid: 'w1', weapon: SCALPEL, step: 3 }, { uid: 'w2', weapon: SCALPEL, step: 1 }, { uid: 'w3', weapon: SCALPEL, step: 5 }];
    const settings = { weaponSettings: { autoReinforce: true as const } };
    const highest = receiveWeapon(owning(copies, settings), SCALPEL, 'sr');
    expect([highest.outcome, highest.profile.weapons?.map((c) => c.step)]).toEqual([4, [4, 1, 5]]);
    const wielded = receiveWeapon(owning(copies, { ...settings, equipped: { virelle: 'w2' } }), SCALPEL, 'sr');
    expect([wielded.outcome, wielded.profile.weapons?.map((c) => c.step)]).toEqual([2, [3, 2, 5]]);
  });

  it('auto-salvages only a weapon already held at +5 and not locked, after reinforcing has had its turn', () => {
    const both = { weaponSettings: { autoReinforce: true as const, autoSalvage: true as const } };
    const maxed = owning([{ uid: 'w1', weapon: SCALPEL, step: 5 }], both);
    expect(receiveWeapon(maxed, SCALPEL, 'sr')).toEqual({ profile: maxed, outcome: 'salvaged', pollen: SALVAGE.sr });
    // A copy below +5 takes it instead.
    expect(receiveWeapon(owning([{ uid: 'w1', weapon: SCALPEL, step: 5 }, { uid: 'w2', weapon: SCALPEL }], both), SCALPEL, 'sr').outcome).toBe(1);
    // Locked, or nothing at +5, and it is kept.
    expect(receiveWeapon(owning([{ uid: 'w1', weapon: SCALPEL, step: 5, locked: true }], both), SCALPEL, 'sr').outcome).toBe('kept');
    expect(receiveWeapon(owning([{ uid: 'w1', weapon: SCALPEL, step: 4 }], { weaponSettings: { autoSalvage: true } }), SCALPEL, 'sr').outcome).toBe('kept');
    // Never the first copy.
    expect(receiveWeapon(owning([], both), SCALPEL, 'sr').outcome).toBe('new');
  });
});

describe('the weapon page', () => {
  it('equips a copy, taking it from its last wielder and returning the new wielder’s old one', () => {
    const p = owning([{ uid: 'w1', weapon: SCALPEL }, { uid: 'w2', weapon: HOOK }], { equipped: { virelle: 'w1', maelia: 'w2' } });
    const moved = ok(equip(p, 'maelia', 'w1'));
    expect(moved.equipped).toEqual({ maelia: 'w1' });
    expect(wieldedBy(moved, registry)).toEqual({ maelia: { weapon: SCALPEL } });
    expect(unequip(moved, 'maelia').equipped).toBeUndefined();
    expect(equip(p, 'maelia', 'w9')).toEqual({ ok: false, reason: 'That weapon is not owned.' });
  });

  it('reinforces with a duplicate of the same weapon, by its copies, up to +5', () => {
    const p = owning([{ uid: 'w1', weapon: SCALPEL, step: 1 }, { uid: 'w2', weapon: SCALPEL, step: 2 }, { uid: 'w3', weapon: HOOK }, { uid: 'w4', weapon: SCALPEL, step: 4 }]);
    expect(ok(reinforce(p, 'w1', 'w2')).weapons).toEqual([{ uid: 'w1', weapon: SCALPEL, step: 4 }, { uid: 'w3', weapon: HOOK }, { uid: 'w4', weapon: SCALPEL, step: 4 }]);
    expect(reinforce(p, 'w1', 'w3')).toEqual({ ok: false, reason: 'Only a copy of the same weapon can reinforce it.' });
    expect(reinforce(p, 'w1', 'w4')).toEqual({ ok: false, reason: 'That would take it past +5.' });
    expect(reinforce({ ...p, equipped: { virelle: 'w2' } }, 'w1', 'w2')).toEqual({ ok: false, reason: 'That copy is wielded.' });
    expect(reinforce(ok(toggleLock(p, 'w2')), 'w1', 'w2')).toEqual({ ok: false, reason: 'That copy is locked.' });
  });

  it('salvages a duplicate for Pollen, paying for every copy in it; never the only copy, a locked or a wielded one', () => {
    const p = owning([{ uid: 'w1', weapon: SCALPEL }, { uid: 'w2', weapon: SCALPEL, step: 2 }, { uid: 'w3', weapon: STAFF }]);
    const done = ok(salvage(p, 'w2', registry));
    expect([done.weapons?.map((c) => c.uid), done.items?.pollen]).toEqual([['w1', 'w3'], SALVAGE.sr * 3]);
    expect(salvage(done, 'w1', registry)).toEqual({ ok: false, reason: 'This is your only copy.' });
    expect(salvage({ ...p, equipped: { virelle: 'w2' } }, 'w2', registry)).toEqual({ ok: false, reason: 'That copy is wielded.' });
    expect(salvage(ok(toggleLock(p, 'w2')), 'w2', registry)).toEqual({ ok: false, reason: 'That copy is locked.' });
    expect(ok(toggleLock(ok(toggleLock(p, 'w2')), 'w2')).weapons).toEqual(p.weapons);
  });

  it('saves the tickboxes only while one is ticked', () => {
    expect(setWeaponSettings(NEW_PROFILE, { autoSalvage: true }).weaponSettings).toEqual({ autoSalvage: true });
    expect(setWeaponSettings({ ...NEW_PROFILE, weaponSettings: { autoSalvage: true } }, {})).toEqual(NEW_PROFILE);
  });
});

describe('the weapon banner', () => {
  const pulled = (profile: Profile, count: 1 | 10, seed = 3) => {
    const r = pull(profile, WEAPON_BANNER, count, seed);
    if (!r.ok) throw new Error(r.reason);
    return r;
  };

  it('needs its own Focus, a signature weapon, and keeps its own pity apart from the character banner’s', () => {
    expect(pull({ ...NEW_PROFILE, focus: 'a' }, WEAPON_BANNER, 1, 1)).toEqual({ ok: false, reason: 'Choose a Focus first.' });
    const start: Profile = { ...NEW_PROFILE, weaponFocus: STAFF, gacha: { stream: 1, losses: {}, history: [], pity: { character: 7, weapon: HARD_PITY - 1 } } };
    const { profile, records } = pulled(start, 1);
    expect(records[0]).toMatchObject({ rarity: 'ssr', guarantee: 'pity', banner: 'banner.weapon' });
    expect(WEAPON_BANNER.pool).toContain(records[0]!.weapon);
    expect(records[0]!.character).toBeUndefined();
    expect(profile.gacha?.pity).toEqual({ character: 7, weapon: 0 });
    expect(profile.weapons).toEqual([{ uid: 'w1', weapon: records[0]!.weapon }]);
    // A signature pulled is a weapon, not a character.
    expect(profile.owned).toEqual([]);
  });

  it('gives weapons on SR and R results, on both banners, each copy recorded with what became of it', () => {
    for (const banner of [CHARACTER_BANNER, WEAPON_BANNER]) {
      const r = pull({ ...NEW_PROFILE, pulls: 50, focus: 'a', weaponFocus: STAFF }, banner, 10, 5);
      if (!r.ok) throw new Error(r.reason);
      const weapons = r.records.filter((x: PullRecord) => x.weapon);
      expect(r.records.filter((x) => x.rarity === 'sr').every((x) => banner.sr.includes(x.weapon!))).toBe(true);
      expect(weapons.length).toBe(r.profile.weapons?.length ?? 0);
      expect(weapons.every((x) => x.copy === 'new' || x.copy === 'kept')).toBe(true);
    }
  });

  it('an auto-salvaged copy adds its Pollen to the pull’s record', () => {
    const maxed = owning(WEAPON_BANNER.sr.map((weapon, i) => ({ uid: `w${i + 1}`, weapon, step: 5 })), { pulls: 10, weaponFocus: STAFF, weaponSettings: { autoSalvage: true } });
    const { records } = pulled(maxed, 10);
    const salvaged = records.filter((r) => r.rarity === 'sr');
    expect(salvaged.length).toBeGreaterThan(0);
    for (const r of salvaged) expect([r.copy, r.items.pollen]).toEqual(['salvaged', POLLEN_PER_PULL + SALVAGE.sr]);
  });
});
