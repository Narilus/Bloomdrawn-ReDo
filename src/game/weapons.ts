import type { Registry, WeaponDef, Wielded } from '../engine/index.ts';
import { PARTY_SIZE, placeInTeam, quickTeam, removeFromTeam, type Profile, type Team } from './profile.ts';

// Weapons (docs/notes/weapons.md; owner, 15 Nov). The profile owns each weapon once, with its
// reinforcement step (+0 to +5) and its spare copies; a spare reinforces it a step or is salvaged for
// Pollen, and the weapon itself is never salvaged. Weapons are equipped in team presets, one under
// each member and each at most once per preset; one weapon may be in any number of presets. A
// preset's weapon belongs to its member: it moves with her when places swap and leaves with her.
// Pure, like the profile.

/** A weapon owned: its step, +1 to +5 (absent at +0), and its spare copies (absent if none). */
export interface OwnedWeapon {
  step?: number;
  spares?: number;
}

/** The banners' tickboxes (both off by default). */
export interface WeaponSettings {
  /** A new duplicate of a weapon below +5 raises it a step. */
  autoReinforce?: true;
  /** A new duplicate of a weapon at +5 is salvaged. */
  autoSalvage?: true;
}

export const MAX_STEP = 5;
/** Pollen for salvaging one copy, by rarity (placeholders, owner 15 Nov). */
export const SALVAGE: Record<WeaponDef['rarity'], number> = { ssr: 40, sr: 2, r: 1 };

export type WeaponResult = { ok: true; profile: Profile } | { ok: false; reason: string };

const stepOf = (w: OwnedWeapon | undefined) => w?.step ?? 0;
const sparesOf = (w: OwnedWeapon | undefined) => w?.spares ?? 0;
const entry = (step: number, spares: number): OwnedWeapon => ({ ...(step > 0 && { step }), ...(spares > 0 && { spares }) });
const withWeapon = (profile: Profile, id: string, w: OwnedWeapon): Profile => ({ ...profile, weapons: { ...profile.weapons, [id]: w } });

/** What became of a new copy: the weapon itself (`new`), a step (to +N), a spare, or salvaged. */
export type CopyOutcome = 'new' | 'spare' | 'salvaged' | number;

/**
 * A pulled copy joins the profile. The first is the weapon at +0. After that, with auto-reinforce on
 * and the weapon below +5 it raises the step; with auto-salvage on and the weapon at +5 it is
 * salvaged, the caller banking the `pollen`; otherwise it is a spare. Reinforcing goes first.
 */
export function receiveWeapon(profile: Profile, weapon: string, rarity: WeaponDef['rarity']): { profile: Profile; outcome: CopyOutcome; pollen: number } {
  const held = profile.weapons?.[weapon];
  const settings = profile.weaponSettings ?? {};
  if (!held) return { profile: withWeapon(profile, weapon, {}), outcome: 'new', pollen: 0 };
  const step = stepOf(held);
  if (settings.autoReinforce && step < MAX_STEP) return { profile: withWeapon(profile, weapon, entry(step + 1, sparesOf(held))), outcome: step + 1, pollen: 0 };
  if (settings.autoSalvage && step >= MAX_STEP) return { profile, outcome: 'salvaged', pollen: SALVAGE[rarity] };
  return { profile: withWeapon(profile, weapon, entry(step, sparesOf(held) + 1)), outcome: 'spare', pollen: 0 };
}

/** Spends a spare to raise a weapon a step. */
export function reinforce(profile: Profile, weapon: string): WeaponResult {
  const held = profile.weapons?.[weapon];
  if (!held) return { ok: false, reason: 'That weapon is not owned.' };
  if (stepOf(held) >= MAX_STEP) return { ok: false, reason: `It is already +${MAX_STEP}.` };
  if (sparesOf(held) < 1) return { ok: false, reason: 'Reinforcing needs a spare copy.' };
  return { ok: true, profile: withWeapon(profile, weapon, entry(stepOf(held) + 1, sparesOf(held) - 1)) };
}

/** Salvages `count` spares for Pollen. The weapon itself is never salvaged. */
export function salvage(profile: Profile, weapon: string, count: number, registry: Registry): WeaponResult {
  const held = profile.weapons?.[weapon];
  const def = registry.weapons[weapon];
  if (!held || !def) return { ok: false, reason: 'That weapon is not owned.' };
  if (count < 1 || count > sparesOf(held)) return { ok: false, reason: sparesOf(held) === 0 ? 'There are no spares to salvage.' : `There are only ${sparesOf(held)} spares.` };
  const items = { ...profile.items, pollen: (profile.items?.pollen ?? 0) + SALVAGE[def.rarity] * count };
  return { ok: true, profile: { ...withWeapon(profile, weapon, entry(stepOf(held), sparesOf(held) - count)), items } };
}

export function setWeaponSettings(profile: Profile, settings: WeaponSettings): Profile {
  const { weaponSettings: _s, ...rest } = profile;
  const next: WeaponSettings = { ...(settings.autoReinforce && { autoReinforce: true }), ...(settings.autoSalvage && { autoSalvage: true }) };
  return Object.keys(next).length > 0 ? { ...rest, weaponSettings: next } : rest;
}

/** A character's signature weapon, if the profile owns it. */
export const ownedSignature = (profile: Profile, registry: Registry, character: string): string | undefined =>
  Object.values(registry.weapons).find((w) => w.signature === character && profile.weapons?.[w.id])?.id;

// Weapons in a preset.

/** A preset's weapon under each place, PARTY_SIZE long. */
export const teamWeapons = (team: Team): (string | null)[] => Array.from({ length: PARTY_SIZE }, (_, i) => team.weapons?.[i] ?? null);

const withTeamWeapons = (team: Team, members: (string | null)[], weapons: (string | null)[]): Team => {
  const { weapons: _w, ...rest } = team;
  return { ...rest, members, ...(weapons.some((w) => w !== null) && { weapons }) };
};

/**
 * Puts a character in a place (`placeInTeam`): if she was in another place the two swap, each
 * taking her weapon along. A member she replaces leaves with hers. A character new to the preset
 * brings her signature if it's given (owned) and no one else here holds it.
 */
export function placeMember(team: Team, place: number, id: string, signature?: string): Team {
  const weapons = teamWeapons(team);
  const from = team.members.indexOf(id);
  const members = placeInTeam(team.members, place, id);
  if (from >= 0) {
    [weapons[from], weapons[place]] = [weapons[place] ?? null, weapons[from] ?? null];
    if (members[from] === null) weapons[from] = null;
  } else {
    weapons[place] = signature && !weapons.some((w, i) => w === signature && i !== place) ? signature : null;
  }
  return withTeamWeapons(team, members, weapons);
}

/** Empties a place; its weapon leaves with the member. */
export function removeMember(team: Team, place: number): Team {
  const weapons = teamWeapons(team);
  weapons[place] = null;
  return withTeamWeapons(team, removeFromTeam(team.members, place), weapons);
}

/** Quick select: the characters clicked fill the places front first, each with her owned signature. */
export function quickMembers(team: Team, picked: readonly string[], signatureOf: (id: string) => string | undefined): Team {
  const members = quickTeam(picked);
  return withTeamWeapons(team, members, members.map((m) => (m ? (signatureOf(m) ?? null) : null)));
}

/** Puts a weapon under a member; if another place holds it, it moves from there. Null empties the slot. */
export function assignWeapon(team: Team, place: number, weapon: string | null): Team {
  if (!team.members[place]) return team;
  const weapons = teamWeapons(team).map((w) => (weapon !== null && w === weapon ? null : w));
  weapons[place] = weapon;
  return withTeamWeapons(team, [...team.members], weapons);
}

/** The place that holds a weapon in a preset, if one does. */
export const holderOf = (team: Team, weapon: string): number | undefined => {
  const i = teamWeapons(team).indexOf(weapon);
  return i >= 0 ? i : undefined;
};

/** What each member wields in a party with these weapons, at the profile's steps: for a run or a Trial, copied at its start. */
export function wieldedOf(profile: Profile, party: readonly (string | null)[], weapons: readonly (string | null)[], registry: Registry): Record<string, Wielded> {
  const out: Record<string, Wielded> = {};
  party.forEach((character, i) => {
    const weapon = weapons[i];
    const held = weapon ? profile.weapons?.[weapon] : undefined;
    if (!character || !weapon || !held || !registry.weapons[weapon]) return;
    out[character] = stepOf(held) > 0 ? { weapon, step: stepOf(held) } : { weapon };
  });
  return out;
}

/** The presets a weapon is in, and who holds it in each. */
export function presetsWith(teams: readonly Team[], weapon: string): { team: string; member: string }[] {
  return teams.flatMap((t) => {
    const i = teamWeapons(t).indexOf(weapon);
    const member = i >= 0 ? t.members[i] : null;
    return member ? [{ team: t.name, member }] : [];
  });
}
