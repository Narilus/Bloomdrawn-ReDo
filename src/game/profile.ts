import { reached } from './bloom.ts';
import { rewardMultiplier } from './depth.ts';
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
  /** Levels by character, above 1 (`levels.ts`); one never levelled is level 1. */
  levels?: Record<string, number>;
  /** Ascensions made by character, 1 to 3; none is left out. */
  ascensions?: Record<string, number>;
  /** Items banked, by ID: Pollen, Ducats (`money`), Memories and ascension materials. Absent is none. */
  items?: Record<string, number>;
  /** The character banner's Focus: the pool character an SSR's 50/50 is for (owner, 28 Oct). */
  focus?: string;
  /** The gacha's stream, pity, 50/50 losses and audit history, from the first pull. */
  gacha?: Gacha;
  /** Saved team presets, each a party front first. A profile that has never saved one has the defaults (`teamsOf`). */
  teams?: Team[];
  /** The preset party select opens on: the one the player last chose. */
  team?: number;
  /** The depth chosen for the next run (`depth.ts`); absent is Depth 1. */
  depth?: number;
  /** The deepest depth a run has been won at; it opens the bands of depths beyond (owner, 31 Oct). */
  deepest?: number;
  /**
   * The run in progress: its ID and its banking tally, kept here as it changes so a run whose own
   * save can't be read can still bank its share (owner, 24 Oct).
   */
  run?: ActiveRun;
}

export interface ActiveRun {
  id: string;
  elites: number;
  /** The run's depth, for banking its share if its save is lost; absent is Depth 1. */
  depth?: number;
}

/** A new profile starts with 10 Purified Blooms (owner, 25 Oct). */
export const NEW_PROFILE: Profile = { pulls: 10, runs: 0, owned: [] };

export const PARTY_SIZE = 4;
/** Presets every profile has (owner, 26 Oct: 5 to start; more bought with Ducats). */
export const TEAM_PRESETS = 5;
/** The first preset bought costs this many Ducats, and each after it costs `PRESET_STEP` more (owner, 29 Oct, placeholders). */
export const PRESET_COST = 500;
export const PRESET_STEP = 250;
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

/** What the next preset costs in Ducats. */
export const presetCost = (profile: Profile) => PRESET_COST + PRESET_STEP * Math.max(0, (profile.teams?.length ?? TEAM_PRESETS) - TEAM_PRESETS);

/** Buys one more preset, empty and chosen, with Ducats; or refuses and changes nothing. */
export function buyPreset(profile: Profile, owned: readonly string[]): { ok: true; profile: Profile } | { ok: false; reason: string } {
  const cost = presetCost(profile);
  const money = profile.items?.money ?? 0;
  if (money < cost) return { ok: false, reason: `This needs ${cost} Ducats.` };
  const teams = teamsOf(profile, owned);
  const { money: _spent, ...rest } = profile.items ?? {};
  const items = money > cost ? { ...rest, money: money - cost } : rest;
  return { ok: true, profile: { ...profile, items, teams: [...teams, emptyTeam(teams.length)], team: teams.length } };
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

/** What a run banks: pulls, items (Memories, Ducats, a material), and one line per reason for the result screen. */
export interface Banked {
  pulls: number;
  items?: Record<string, number>;
  lines: string[];
  /** A won run's depth past 1, which may open deeper ones. */
  won?: number;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A pull's working name on screen (docs/notes/m5-collection.md, "Names"). */
export const BLOOM = 'Purified Bloom';

/** How a count of an item reads on screen; the names are content's (`src/content/items.ts`). */
export type ItemText = (id: string, n: number) => string;

type Items = Readonly<Record<string, number>>;
const times = (items: Items, n: number): Record<string, number> => Object.fromEntries(Object.entries(items).map(([id, k]) => [id, Math.floor(k * n)]));
function sum(...all: Items[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const items of all) for (const [id, n] of Object.entries(items)) if (n > 0) out[id] = (out[id] ?? 0) + n;
  return out;
}
/** "5 Purified Blooms, 1 Vivid Memory, 500 Ducats". */
const gains = (pulls: number, items: Items, name: ItemText) =>
  [...(pulls > 0 ? [plural(pulls, BLOOM)] : []), ...Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => name(id, n))].join(', ');

/**
 * A win banks the win's pulls with Memories and Ducats for the Boss, each normal fight won and each
 * elite, all multiplied if the Boss fell at Fruiting (her fight never ticks the clock, so the run's
 * clock is the one she was fought at), and the Boss's material, never multiplied. A defeat or abandon
 * banks per elite beaten, up to a cap, and nothing else: a run quit before any progress banks nothing
 * (owner, 24 Oct; Memories and Ducats, 29 Oct). A run's depth multiplies its Memories and Ducats, a
 * won run's or a lost one's (owner, 29 and 31 Oct), rounding each down; the material and the Blooms
 * stay as they are.
 */
export function runBanking(exp: Expedition, end: RunEnd, def: ExpeditionDef, name: ItemText): Banked {
  const { win, fruiting, items } = def.banking;
  const depth = exp.depth ?? 1;
  if (end !== 'won') return lossBanking(exp.elites, def, name, depth);
  const fights = exp.fights ?? 0;
  const lines = [`The Boss beaten: ${gains(win, items.boss, name)}`];
  if (fights > 0) lines.push(`${plural(fights, 'fight')} won: ${gains(0, times(items.fight, fights), name)}`);
  if (exp.elites > 0) lines.push(`${plural(exp.elites, 'elite')} beaten: ${gains(0, times(items.elite, exp.elites), name)}`);
  const n = reached(exp.clock, 'fruiting') ? fruiting : 1;
  if (n > 1) lines.push(`The Boss at Fruiting: ×${n}`);
  const deeper = depthLine(depth);
  if (deeper) lines.push(deeper);
  const earned = times(times(sum(items.boss, times(items.fight, fights), times(items.elite, exp.elites)), n), rewardMultiplier(depth));
  if (exp.material) lines.push(`The Boss's material: ${name(exp.material, 1)}`);
  return { pulls: win * n, items: sum(earned, exp.material ? { [exp.material]: 1 } : {}), lines, ...(depth > 1 && { won: depth }) };
}

/** "Depth 12: Memories and Ducats ×3.75", or nothing at Depth 1. */
const depthLine = (depth: number) => (depth > 1 ? `Depth ${depth}: Memories and Ducats ×${Number(rewardMultiplier(depth).toFixed(2))}` : undefined);

/** What a run that didn't win banks: its share for the elites it beat, up to the cap, at its depth. */
export function lossBanking(elites: number, def: ExpeditionDef, name: ItemText, depth = 1): Banked {
  const { perElite, elitesMax, items } = def.banking;
  if (elites === 0) return { pulls: 0, lines: ['No elites beaten: nothing banked'] };
  const counted = Math.min(elites, elitesMax);
  const pulls = counted * perElite;
  const banked = times(times(items.elite, counted), rewardMultiplier(depth));
  const capped = elites > elitesMax ? ` (${elitesMax} at most)` : '';
  const deeper = depthLine(depth);
  return { pulls, items: banked, lines: [`${plural(elites, 'elite')} beaten: ${gains(pulls, banked, name)}${capped}`, ...(deeper ? [deeper] : [])] };
}

/** The profile after a run ends: what it banked added, the run counted and no longer in progress. */
export function bank(profile: Profile, banked: Banked): Profile {
  const { run: _ended, ...rest } = profile;
  const items = banked.items && Object.keys(banked.items).length > 0 ? { items: sum(profile.items ?? {}, banked.items) } : {};
  const deepest = banked.won !== undefined && banked.won > (profile.deepest ?? 0) ? { deepest: banked.won } : {};
  return { ...rest, ...items, ...deepest, pulls: profile.pulls + banked.pulls, runs: profile.runs + 1 };
}
