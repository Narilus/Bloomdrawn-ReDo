import type { Registry, WeaponDef, Wielded } from '../engine/index.ts';
import type { Profile } from './profile.ts';

// Owned weapons (docs/notes/weapons.md; owner, 14 Nov): copies in the profile, one wielder each.
// A duplicate reinforces a copy of the same weapon from +0 to +5, or is salvaged for Pollen. A
// weapon's first copy is never salvaged, and a locked copy never is. Pure, like the profile.

/** One weapon copy. `step` is its reinforcement, +1 to +5 (absent at +0). */
export interface WeaponCopy {
  uid: string;
  weapon: string;
  step?: number;
  locked?: true;
}

/** The banners' tickboxes (both off by default). */
export interface WeaponSettings {
  /** A new duplicate reinforces a copy below +5. */
  autoReinforce?: true;
  /** A new duplicate of a weapon held at +5 is salvaged. */
  autoSalvage?: true;
}

export const MAX_STEP = 5;
/** Pollen for salvaging one copy, by rarity; a reinforced copy pays for every copy in it (placeholders, owner 14 Nov). */
export const SALVAGE: Record<WeaponDef['rarity'], number> = { ssr: 40, sr: 2, r: 1 };

export type WeaponResult = { ok: true; profile: Profile } | { ok: false; reason: string };

const stepOf = (copy: WeaponCopy) => copy.step ?? 0;
const copiesOf = (profile: Profile) => profile.weapons ?? [];
const find = (profile: Profile, uid: string) => copiesOf(profile).find((c) => c.uid === uid);
/** The character wielding a copy, if any. */
export const wielderOf = (profile: Profile, uid: string) => Object.entries(profile.equipped ?? {}).find(([, u]) => u === uid)?.[0];
/** Pollen a copy salvages for. */
export const salvageValue = (copy: WeaponCopy, registry: Registry) => (SALVAGE[registry.weapons[copy.weapon]?.rarity ?? 'r'] ?? 0) * (1 + stepOf(copy));

/** The weapon each character wields, for runs and Trials, skipping copies or weapons that no longer exist. */
export function wieldedBy(profile: Profile, registry: Registry): Record<string, Wielded> {
  const out: Record<string, Wielded> = {};
  for (const [character, uid] of Object.entries(profile.equipped ?? {})) {
    const copy = find(profile, uid);
    if (!copy || !registry.weapons[copy.weapon]) continue;
    out[character] = copy.step ? { weapon: copy.weapon, step: copy.step } : { weapon: copy.weapon };
  }
  return out;
}

const nextUid = (copies: readonly WeaponCopy[]) => `w${1 + copies.reduce((n, c) => Math.max(n, Number(c.uid.slice(1)) || 0), 0)}`;

const withCopies = (profile: Profile, weapons: WeaponCopy[], equipped = profile.equipped): Profile => {
  const { weapons: _w, equipped: _e, ...rest } = profile;
  return { ...rest, ...(weapons.length > 0 && { weapons }), ...(equipped && Object.keys(equipped).length > 0 && { equipped }) };
};

/** A character takes up a copy; whoever wielded it lets it go, and her own last weapon goes back to the inventory. */
export function equip(profile: Profile, character: string, uid: string): WeaponResult {
  if (!find(profile, uid)) return { ok: false, reason: 'That weapon is not owned.' };
  const equipped = Object.fromEntries(Object.entries(profile.equipped ?? {}).filter(([c, u]) => u !== uid && c !== character));
  return { ok: true, profile: withCopies(profile, copiesOf(profile), { ...equipped, [character]: uid }) };
}

export function unequip(profile: Profile, character: string): Profile {
  const { [character]: _gone, ...equipped } = profile.equipped ?? {};
  return withCopies(profile, copiesOf(profile), equipped);
}

/** Feeds a duplicate into a copy of the same weapon: it rises by the duplicate's copies, one plus its own step, up to +5. */
export function reinforce(profile: Profile, uid: string, fodderUid: string): WeaponResult {
  const target = find(profile, uid);
  const fodder = find(profile, fodderUid);
  if (!target || !fodder || uid === fodderUid) return { ok: false, reason: 'Choose two copies.' };
  if (target.weapon !== fodder.weapon) return { ok: false, reason: 'Only a copy of the same weapon can reinforce it.' };
  if (fodder.locked) return { ok: false, reason: 'That copy is locked.' };
  if (wielderOf(profile, fodderUid)) return { ok: false, reason: 'That copy is wielded.' };
  const step = stepOf(target) + 1 + stepOf(fodder);
  if (step > MAX_STEP) return { ok: false, reason: `That would take it past +${MAX_STEP}.` };
  const weapons = copiesOf(profile)
    .filter((c) => c.uid !== fodderUid)
    .map((c) => (c.uid === uid ? { ...c, step } : c));
  return { ok: true, profile: withCopies(profile, weapons) };
}

/** Salvages a duplicate for Pollen. The last copy of a weapon, a locked copy and a wielded copy are kept. */
export function salvage(profile: Profile, uid: string, registry: Registry): WeaponResult {
  const copy = find(profile, uid);
  if (!copy) return { ok: false, reason: 'That weapon is not owned.' };
  if (copy.locked) return { ok: false, reason: 'That copy is locked.' };
  if (wielderOf(profile, uid)) return { ok: false, reason: 'That copy is wielded.' };
  if (!copiesOf(profile).some((c) => c.weapon === copy.weapon && c.uid !== uid)) return { ok: false, reason: 'This is your only copy.' };
  const items = { ...profile.items, pollen: (profile.items?.pollen ?? 0) + salvageValue(copy, registry) };
  return { ok: true, profile: { ...withCopies(profile, copiesOf(profile).filter((c) => c.uid !== uid)), items } };
}

export function toggleLock(profile: Profile, uid: string): WeaponResult {
  const copy = find(profile, uid);
  if (!copy) return { ok: false, reason: 'That weapon is not owned.' };
  const weapons = copiesOf(profile).map((c) => {
    if (c.uid !== uid) return c;
    const { locked: _l, ...rest } = c;
    return copy.locked ? rest : { ...rest, locked: true as const };
  });
  return { ok: true, profile: withCopies(profile, weapons) };
}

export function setWeaponSettings(profile: Profile, settings: WeaponSettings): Profile {
  const { weaponSettings: _s, ...rest } = profile;
  const next: WeaponSettings = { ...(settings.autoReinforce && { autoReinforce: true }), ...(settings.autoSalvage && { autoSalvage: true }) };
  return Object.keys(next).length > 0 ? { ...rest, weaponSettings: next } : rest;
}

/** What became of a new copy: kept (the first is `new`), reinforced into a copy (to +N), or salvaged. */
export type CopyOutcome = 'new' | 'kept' | 'salvaged' | number;

/**
 * A pulled copy joins the profile. The first copy of a weapon is always kept. Otherwise, with
 * auto-reinforce on, it reinforces a copy below +5, the wielded ones first, then the highest; with
 * auto-salvage on, a copy of a weapon held at +5 and not locked is salvaged: the caller banks the
 * `pollen`. Reinforcing goes first.
 */
export function receiveWeapon(profile: Profile, weapon: string, rarity: WeaponDef['rarity']): { profile: Profile; outcome: CopyOutcome; pollen: number } {
  const copies = copiesOf(profile);
  const same = copies.filter((c) => c.weapon === weapon);
  const settings = profile.weaponSettings ?? {};
  const keep = (outcome: CopyOutcome) => ({ profile: withCopies(profile, [...copies, { uid: nextUid(copies), weapon }]), outcome, pollen: 0 });
  if (same.length === 0) return keep('new');
  if (settings.autoReinforce) {
    const below = same.filter((c) => stepOf(c) < MAX_STEP);
    const wielded = (c: WeaponCopy) => (wielderOf(profile, c.uid) ? 1 : 0);
    const into = below.sort((a, b) => wielded(b) - wielded(a) || stepOf(b) - stepOf(a))[0];
    if (into) {
      const step = stepOf(into) + 1;
      return { profile: withCopies(profile, copies.map((c) => (c === into ? { ...c, step } : c))), outcome: step, pollen: 0 };
    }
  }
  if (settings.autoSalvage && same.some((c) => stepOf(c) >= MAX_STEP) && !same.some((c) => c.locked)) {
    return { profile, outcome: 'salvaged', pollen: SALVAGE[rarity] };
  }
  return keep('kept');
}
