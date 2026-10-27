import { reached } from './bloom.ts';
import type { Expedition, ExpeditionDef } from './expedition.ts';
import type { Gacha } from './gacha.ts';

// The player's profile, kept across runs (docs/notes/m4-run.md, "Banking"; m5-collection.md): banked
// pulls (Purified Blooms on screen), a run count, the characters gained, items and the gacha. Pure, like the run.

export interface Profile {
  pulls: number;
  /** Runs ended: won, lost or abandoned. */
  runs: number;
  /** Characters gained, in the order they came. Every profile also owns the starters, which aren't listed. */
  owned: string[];
  /** Dupe levels (C1–C5) by character; a character gained once has none. */
  dupes?: Record<string, number>;
  /** Items banked, by ID: Pollen, Ducats (`money`), Memories and ascension materials. Absent is none. */
  items?: Record<string, number>;
  /** The gacha's stream, pity and audit history, from the first pull. */
  gacha?: Gacha;
  /** Saved team presets, each a party front first. A profile that has never saved one has the defaults (`teamsOf`). */
  teams?: Team[];
  /** The preset party select opens on: the one the player last chose. */
  team?: number;
  /**
   * The run in progress: its ID and its banking tally, kept here as it changes so a run whose own
   * save can't be read can still bank its share (owner, 24 Oct).
   */
  run?: ActiveRun;
}

export interface ActiveRun {
  id: string;
  elites: number;
}

/** A new profile starts with 10 Purified Blooms (owner, 25 Oct). */
export const NEW_PROFILE: Profile = { pulls: 10, runs: 0, owned: [] };

export const PARTY_SIZE = 4;
/** Presets every profile has (owner, 26 Oct: 5 to start; more bought with Ducats later). */
export const TEAM_PRESETS = 5;
export const TEAM_NAME_LENGTH = 24;

/** A team preset: a name the player can change and the party's places, front first; null is an empty place. */
export interface Team {
  name: string;
  members: (string | null)[];
}

/** The characters a profile can field: the starters, then those it has gained. */
export const ownedCharacters = (profile: Profile, starters: readonly string[]): string[] => [...new Set([...starters, ...profile.owned])];

/** Why a party can't start a run, or undefined if it can: four different characters, all owned (owner, 25 Oct: any four). */
export function partyProblem(party: readonly (string | null)[], owned: readonly string[]): string | undefined {
  if (party.length !== PARTY_SIZE || party.includes(null)) return `A party is ${PARTY_SIZE} characters.`;
  if (new Set(party).size !== party.length) return 'A character can be in the party only once.';
  if (party.some((id) => !owned.includes(id!))) return "The party has a character you don't own.";
  return undefined;
}

export const teamName = (index: number) => `Team ${index + 1}`;
export const emptyTeam = (index: number): Team => ({ name: teamName(index), members: Array<null>(PARTY_SIZE).fill(null) });

/** A profile's presets: those it saved, else the defaults, with the first four owned in Team 1. */
export function teamsOf(profile: Profile, owned: readonly string[]): Team[] {
  if (profile.teams) return profile.teams.map((t) => ({ name: t.name, members: [...t.members] }));
  const teams = Array.from({ length: TEAM_PRESETS }, (_, i) => emptyTeam(i));
  teams[0]!.members = Array.from({ length: PARTY_SIZE }, (_, i) => owned[i] ?? null);
  return teams;
}

/**
 * Puts a character in a place. If she is already in another place the two swap, so the one there
 * moves to hers (owner, 26 Oct).
 */
export function placeInTeam(members: readonly (string | null)[], place: number, id: string): (string | null)[] {
  const next = [...members];
  const from = next.indexOf(id);
  if (from >= 0) next[from] = next[place] ?? null;
  next[place] = id;
  return next;
}

export function removeFromTeam(members: readonly (string | null)[], place: number): (string | null)[] {
  return members.map((m, i) => (i === place ? null : m));
}

/** Quick select: the characters in the order they were clicked fill the places front first. */
export const quickTeam = (picked: readonly string[]): (string | null)[] =>
  Array.from({ length: PARTY_SIZE }, (_, i) => picked[i] ?? null);

/** A new name, trimmed and cut to length; a blank one goes back to the default. */
export function renameTeam(name: string, index: number): string {
  const trimmed = name.trim().slice(0, TEAM_NAME_LENGTH);
  return trimmed || teamName(index);
}

export type RunEnd = 'won' | 'lost' | 'abandoned';

/** What a run banks, with one line per reason for the result screen. */
export interface Banked {
  pulls: number;
  lines: string[];
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A pull's working name on screen (docs/notes/m5-collection.md, "Names"). */
export const BLOOM = 'Purified Bloom';

/**
 * A win banks the win's pulls, multiplied if the Boss fell at Fruiting (her fight never ticks the
 * clock, so the run's clock is the one she was fought at). A defeat or abandon banks per elite
 * beaten, up to a cap, and nothing else: a run quit before any progress banks nothing (owner, 24 Oct).
 */
export function runBanking(exp: Expedition, end: RunEnd, def: ExpeditionDef): Banked {
  const { win, fruiting } = def.banking;
  if (end === 'won') {
    if (!reached(exp.clock, 'fruiting')) return { pulls: win, lines: [`The Boss beaten: ${plural(win, BLOOM)}`] };
    return { pulls: win * fruiting, lines: [`The Boss beaten: ${plural(win, BLOOM)}`, `The Boss at Fruiting: ×${fruiting}`] };
  }
  return lossBanking(exp.elites, def);
}

/** What a run that didn't win banks: its share for the elites it beat, up to the cap. */
export function lossBanking(elites: number, def: ExpeditionDef): Banked {
  const { perElite, elitesMax } = def.banking;
  if (elites === 0) return { pulls: 0, lines: ['No elites beaten: nothing banked'] };
  const pulls = Math.min(elites * perElite, elitesMax * perElite);
  const capped = elites > elitesMax ? ` (${elitesMax} at most)` : '';
  return { pulls, lines: [`${plural(elites, 'elite')} beaten: ${plural(pulls, BLOOM)}${capped}`] };
}

/** The profile after a run ends: its pulls banked, the run counted and no longer in progress. */
export function bank(profile: Profile, banked: Banked): Profile {
  const { run: _ended, ...rest } = profile;
  return { ...rest, pulls: profile.pulls + banked.pulls, runs: profile.runs + 1 };
}
