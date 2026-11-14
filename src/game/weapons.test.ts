import { describe, expect, it } from 'vitest';
import type { BannerDef, Registry, WeaponDef } from '../engine/index.ts';
import { HARD_PITY, POLLEN_PER_PULL, pull } from './gacha.ts';
import { NEW_PROFILE, type Profile, type Team } from './profile.ts';
import {
  assignWeapon,
  holderOf,
  ownedSignature,
  placeMember,
  presetsWith,
  quickMembers,
  receiveWeapon,
  reinforce,
  removeMember,
  SALVAGE,
  salvage,
  setWeaponSettings,
  teamWeapons,
  wieldedOf,
  type OwnedWeapon,
} from './weapons.ts';

// Weapons (docs/notes/weapons.md; owner, 15 Nov): each owned once, with a step and spares; a spare
// reinforces it or is salvaged, never the weapon itself; the banners' two tickboxes; weapons in team
// presets, once per preset, moving and leaving with their member; the weapon banner.

const SCALPEL = 'w.sr1';
const HOOK = 'w.r1';
const STAFF = 'w.ssr1';
const VEIL = 'w.ssr2';
const def = (id: string, rarity: WeaponDef['rarity'], signature?: string): WeaponDef => ({ id, name: id, rarity, ...(signature && { signature }), main: { stat: 'attack', amount: 10 }, steps: [] });
const registry = {
  weapons: Object.fromEntries([def(STAFF, 'ssr', 'maelia'), def(VEIL, 'ssr', 'isadora'), def(SCALPEL, 'sr'), def('w.sr2', 'sr'), def(HOOK, 'r')].map((w) => [w.id, w])),
} as unknown as Registry;
const items = { 'memory.faint': 1, money: 100 };
const CHARACTER_BANNER: BannerDef = { id: 'banner.c', name: 'C', kind: 'character', pity: 'character', pool: ['a', 'b'], sr: [SCALPEL, 'w.sr2'], r: { weapons: [HOOK], chance: 0.5, items } };
const WEAPON_BANNER: BannerDef = { id: 'banner.weapon', name: 'W', kind: 'weapon', pity: 'weapon', pool: [STAFF, VEIL], sr: [SCALPEL, 'w.sr2'], r: { weapons: [HOOK], chance: 0.5, items } };
const owning = (weapons: Record<string, OwnedWeapon>, extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, weapons, ...extra });
const ok = (r: { ok: true; profile: Profile } | { ok: false; reason: string }) => {
  if (!r.ok) throw new Error(r.reason);
  return r.profile;
};

describe('a pulled copy', () => {
  it('is the weapon the first time, and a spare after, with both tickboxes off', () => {
    const first = receiveWeapon(NEW_PROFILE, SCALPEL, 'sr');
    expect(first).toEqual({ profile: owning({ [SCALPEL]: {} }), outcome: 'new', pollen: 0 });
    const second = receiveWeapon(first.profile, SCALPEL, 'sr');
    expect([second.outcome, second.profile.weapons]).toEqual(['spare', { [SCALPEL]: { spares: 1 } }]);
  });

  it('auto-reinforces a weapon below +5, keeping its spares', () => {
    const r = receiveWeapon(owning({ [SCALPEL]: { step: 3, spares: 2 } }, { weaponSettings: { autoReinforce: true } }), SCALPEL, 'sr');
    expect([r.outcome, r.profile.weapons?.[SCALPEL]]).toEqual([4, { step: 4, spares: 2 }]);
  });

  it('auto-salvages only a duplicate of a weapon at +5, after reinforcing has had its turn', () => {
    const both = { weaponSettings: { autoReinforce: true as const, autoSalvage: true as const } };
    const maxed = owning({ [SCALPEL]: { step: 5 } }, both);
    expect(receiveWeapon(maxed, SCALPEL, 'sr')).toEqual({ profile: maxed, outcome: 'salvaged', pollen: SALVAGE.sr });
    expect(receiveWeapon(owning({ [SCALPEL]: { step: 4 } }, both), SCALPEL, 'sr').outcome).toBe(5);
    // Salvage alone leaves a weapon below +5 a spare; at +5 without it, a spare too.
    expect(receiveWeapon(owning({ [SCALPEL]: { step: 4 } }, { weaponSettings: { autoSalvage: true } }), SCALPEL, 'sr').outcome).toBe('spare');
    expect(receiveWeapon(owning({ [SCALPEL]: { step: 5 } }), SCALPEL, 'sr').outcome).toBe('spare');
    expect(receiveWeapon(owning({}, both), SCALPEL, 'sr').outcome).toBe('new');
  });
});

describe('spares', () => {
  it('a spare reinforces its weapon a step, up to +5', () => {
    expect(ok(reinforce(owning({ [SCALPEL]: { step: 1, spares: 2 } }), SCALPEL)).weapons).toEqual({ [SCALPEL]: { step: 2, spares: 1 } });
    expect(ok(reinforce(owning({ [SCALPEL]: { spares: 1 } }), SCALPEL)).weapons).toEqual({ [SCALPEL]: { step: 1 } });
    expect(reinforce(owning({ [SCALPEL]: { step: 2 } }), SCALPEL)).toEqual({ ok: false, reason: 'Reinforcing needs a spare copy.' });
    expect(reinforce(owning({ [SCALPEL]: { step: 5, spares: 1 } }), SCALPEL)).toEqual({ ok: false, reason: 'It is already +5.' });
    expect(reinforce(NEW_PROFILE, SCALPEL)).toEqual({ ok: false, reason: 'That weapon is not owned.' });
  });

  it('spares salvage for Pollen by rarity; the weapon itself never does', () => {
    const done = ok(salvage(owning({ [SCALPEL]: { step: 2, spares: 3 } }, { items: { pollen: 5 } }), SCALPEL, 2, registry));
    expect([done.weapons, done.items?.pollen]).toEqual([{ [SCALPEL]: { step: 2, spares: 1 } }, 5 + 2 * SALVAGE.sr]);
    expect(salvage(owning({ [SCALPEL]: { step: 2 } }), SCALPEL, 1, registry)).toEqual({ ok: false, reason: 'There are no spares to salvage.' });
    expect(salvage(owning({ [SCALPEL]: { spares: 1 } }), SCALPEL, 2, registry)).toEqual({ ok: false, reason: 'There are only 1 spares.' });
  });

  it('saves the tickboxes only while one is ticked', () => {
    expect(setWeaponSettings(NEW_PROFILE, { autoSalvage: true }).weaponSettings).toEqual({ autoSalvage: true });
    expect(setWeaponSettings({ ...NEW_PROFILE, weaponSettings: { autoSalvage: true } }, {})).toEqual(NEW_PROFILE);
  });
});

describe('weapons in a preset', () => {
  const team: Team = { name: 'Team 1', members: ['maelia', 'agathe', 'anthe', null], weapons: [STAFF, SCALPEL, null, null] };

  it('a weapon goes under one member; one another place holds moves from there; none empties the slot', () => {
    expect(teamWeapons(assignWeapon(team, 2, SCALPEL))).toEqual([STAFF, null, SCALPEL, null]);
    expect(holderOf(team, SCALPEL)).toBe(1);
    expect(assignWeapon(team, 3, HOOK)).toBe(team);
    expect(assignWeapon({ ...team, weapons: [STAFF, null, null, null] }, 0, null)).toEqual({ name: 'Team 1', members: team.members });
  });

  it('a weapon moves with its member when places swap, and leaves with her', () => {
    const swapped = placeMember(team, 0, 'agathe');
    expect([swapped.members, teamWeapons(swapped)]).toEqual([['agathe', 'maelia', 'anthe', null], [SCALPEL, STAFF, null, null]]);
    // Into an empty place, the place she left empties with her weapon.
    const moved = placeMember(team, 3, 'maelia');
    expect([moved.members, teamWeapons(moved)]).toEqual([[null, 'agathe', 'anthe', 'maelia'], [null, SCALPEL, null, STAFF]]);
    expect(teamWeapons(removeMember(team, 1))).toEqual([STAFF, null, null, null]);
    // A member replaced leaves with hers.
    expect(teamWeapons(placeMember(team, 1, 'kibane'))).toEqual([STAFF, null, null, null]);
  });

  it('a character joining brings her owned signature, unless another place holds it', () => {
    expect(teamWeapons(placeMember(team, 3, 'isadora', VEIL))).toEqual([STAFF, SCALPEL, null, VEIL]);
    expect(teamWeapons(placeMember({ ...team, weapons: [VEIL, null, null, null] }, 3, 'isadora', VEIL))).toEqual([VEIL, null, null, null]);
    expect(teamWeapons(quickMembers(team, ['isadora', 'maelia'], (id) => (id === 'isadora' ? VEIL : undefined)))).toEqual([VEIL, null, null, null]);
    expect(ownedSignature(owning({ [VEIL]: {} }), registry, 'isadora')).toBe(VEIL);
    expect(ownedSignature(owning({ [VEIL]: {} }), registry, 'maelia')).toBeUndefined();
  });

  it("a run copies its preset's weapons at their steps; the presets a weapon is in are listed", () => {
    const profile = owning({ [STAFF]: { step: 2 }, [SCALPEL]: {} });
    expect(wieldedOf(profile, team.members, teamWeapons(team), registry)).toEqual({ maelia: { weapon: STAFF, step: 2 }, agathe: { weapon: SCALPEL } });
    expect(wieldedOf(NEW_PROFILE, team.members, teamWeapons(team), registry)).toEqual({});
    expect(presetsWith([team, { name: 'Team 2', members: ['agathe', null, null, null], weapons: [SCALPEL, null, null, null] }], SCALPEL)).toEqual([
      { team: 'Team 1', member: 'agathe' },
      { team: 'Team 2', member: 'agathe' },
    ]);
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
    expect(profile.weapons).toEqual({ [records[0]!.weapon!]: {} });
    // A signature pulled is a weapon, not a character.
    expect(profile.owned).toEqual([]);
  });

  it('gives weapons on SR and R results, on both banners, each copy recorded with what became of it', () => {
    for (const banner of [CHARACTER_BANNER, WEAPON_BANNER]) {
      const r = pull({ ...NEW_PROFILE, pulls: 50, focus: 'a', weaponFocus: STAFF }, banner, 10, 5);
      if (!r.ok) throw new Error(r.reason);
      const got = r.records.filter((x) => x.weapon);
      expect(r.records.filter((x) => x.rarity === 'sr').every((x) => banner.sr.includes(x.weapon!))).toBe(true);
      // Each weapon owned once; its first copy new, every later one a spare.
      const counted: Record<string, number> = {};
      for (const x of got) counted[x.weapon!] = (counted[x.weapon!] ?? 0) + 1;
      expect(r.profile.weapons).toEqual(Object.fromEntries(Object.entries(counted).map(([w, n]) => [w, n > 1 ? { spares: n - 1 } : {}])));
      expect(got.every((x) => x.copy === 'new' || x.copy === 'spare')).toBe(true);
    }
  });

  it('an auto-salvaged copy adds its Pollen to the pull’s record', () => {
    const maxed = owning(Object.fromEntries(WEAPON_BANNER.sr.map((w) => [w, { step: 5 }])), { pulls: 10, weaponFocus: STAFF, weaponSettings: { autoSalvage: true } });
    const { records } = pulled(maxed, 10);
    const salvaged = records.filter((r) => r.rarity === 'sr');
    expect(salvaged.length).toBeGreaterThan(0);
    for (const r of salvaged) expect([r.copy, r.items.pollen]).toEqual(['salvaged', POLLEN_PER_PULL + SALVAGE.sr]);
  });
});
