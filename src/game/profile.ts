import { reached } from './bloom.ts';
import type { Expedition, ExpeditionDef } from './expedition.ts';

// The player's profile, kept across runs (docs/notes/m4-run.md, "Banking"). Until M5's profile
// systems it holds only banked pulls and a run count. Pure, like the run.

export interface Profile {
  pulls: number;
  /** Runs ended: won, lost or abandoned. */
  runs: number;
}

export const NEW_PROFILE: Profile = { pulls: 0, runs: 0 };

export type RunEnd = 'won' | 'lost' | 'abandoned';

/** What a run banks, with one line per reason for the result screen. */
export interface Banked {
  pulls: number;
  lines: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A win banks the win's pulls, multiplied if the Boss fell at Fruiting (her fight never ticks the
 * clock, so the run's clock is the one she was fought at). A defeat or abandon banks per elite
 * beaten, up to a cap, and nothing else: a run quit before any progress banks nothing (owner, 24 Oct).
 */
export function runBanking(exp: Expedition, end: RunEnd, def: ExpeditionDef): Banked {
  const { win, fruiting, perElite, elitesMax } = def.banking;
  if (end === 'won') {
    if (!reached(exp.clock, 'fruiting')) return { pulls: win, lines: [`The Boss beaten: ${plural(win, 'pull')}`] };
    return { pulls: win * fruiting, lines: [`The Boss beaten: ${plural(win, 'pull')}`, `The Boss at Fruiting: ×${fruiting}`] };
  }
  if (exp.elites === 0) return { pulls: 0, lines: ['No elites beaten: nothing banked'] };
  const pulls = Math.min(exp.elites * perElite, elitesMax * perElite);
  const capped = exp.elites > elitesMax ? ` (${elitesMax} at most)` : '';
  return { pulls, lines: [`${plural(exp.elites, 'elite')} beaten: ${plural(pulls, 'pull')}${capped}`] };
}

/** The profile after a run ends: its pulls banked and the run counted. */
export function bank(profile: Profile, banked: Banked): Profile {
  return { ...profile, pulls: profile.pulls + banked.pulls, runs: profile.runs + 1 };
}
