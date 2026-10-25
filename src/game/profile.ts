import { reached } from './bloom.ts';
import type { Expedition, ExpeditionDef } from './expedition.ts';

// The player's profile, kept across runs (docs/notes/m4-run.md, "Banking"; m5-collection.md): banked
// pulls (Purified Blooms on screen), a run count and the characters gained. Pure, like the run.

export interface Profile {
  pulls: number;
  /** Runs ended: won, lost or abandoned. */
  runs: number;
  /** Characters gained, in the order they came. Every profile also owns the starters, which aren't listed. */
  owned: string[];
  /** The party the last run started with, front first, offered again by party select. */
  party?: string[];
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

export const NEW_PROFILE: Profile = { pulls: 0, runs: 0, owned: [] };

export const PARTY_SIZE = 4;

/** The characters a profile can field: the starters, then those it has gained. */
export const ownedCharacters = (profile: Profile, starters: readonly string[]): string[] => [...new Set([...starters, ...profile.owned])];

/** Why a party can't start a run, or undefined if it can: four different characters, all owned (owner, 25 Oct: any four). */
export function partyProblem(party: readonly string[], owned: readonly string[]): string | undefined {
  if (party.length !== PARTY_SIZE) return `A party is ${PARTY_SIZE} characters.`;
  if (new Set(party).size !== party.length) return 'A character can be in the party only once.';
  if (party.some((id) => !owned.includes(id))) return 'The party has a character you don\'t own.';
  return undefined;
}

/** The party party select starts with: the last run's if it still works, else the first four owned. */
export function defaultParty(profile: Profile, owned: readonly string[]): string[] {
  return profile.party && !partyProblem(profile.party, owned) ? [...profile.party] : owned.slice(0, PARTY_SIZE);
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
