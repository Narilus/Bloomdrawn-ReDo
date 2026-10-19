import {
  createStreams,
  nextInt,
  shuffleInPlace,
  type CombatSetup,
  type CombatState,
  type Registry,
  type Streams,
} from '../engine/index.ts';

// A run as a fixed sequence of fights: the M2 gauntlet (docs/notes/m2-content.md). Party HP,
// ultimate gauges and relics carry from fight to fight. Pure and seeded, like the engine;
// the Labyrinth replaces the fixed sequence in M3.

export const RUN_STREAMS = ['encounters', 'rewards'] as const;
type RunStream = (typeof RUN_STREAMS)[number];

/** One fight of a gauntlet: an encounter drawn from a pool. */
export interface GauntletStep {
  pool: string[];
}

export interface GauntletDef {
  steps: GauntletStep[];
  /** Relics a victory may offer. */
  relicPool: string[];
  /** How many relics a victory offers to choose from. */
  offer: number;
}

/** Plain JSON, like combat state. */
export interface RunState {
  party: string[];
  /** The encounter and combat seed for each step, fixed when the run starts. */
  encounters: string[];
  seeds: number[];
  /** Index of the current fight. */
  fight: number;
  phase: 'fighting' | 'reward' | 'won' | 'lost';
  hp: number | null;
  gauges: number[];
  relics: string[];
  /** Relics offered after the last victory, while choosing. */
  offered: string[];
  rng: Streams<RunStream>;
}

export function startRun(seed: number, party: string[], gauntlet: GauntletDef): RunState {
  const rng = createStreams(seed, RUN_STREAMS);
  // Each step draws from its pool, avoiding encounters already drawn while any remain.
  const encounters: string[] = [];
  for (const step of gauntlet.steps) {
    const fresh = step.pool.filter((id) => !encounters.includes(id));
    const pool = fresh.length > 0 ? fresh : step.pool;
    encounters.push(pool[nextInt(rng, 'encounters', pool.length)] as string);
  }
  const seeds = gauntlet.steps.map(() => nextInt(rng, 'encounters', 2 ** 31));
  return { party, encounters, seeds, fight: 0, phase: 'fighting', hp: null, gauges: party.map(() => 0), relics: [], offered: [], rng };
}

/** The combat setup for the current fight, carrying the run's HP, gauges and relics. */
export function fightSetup(run: RunState, registry: Registry): CombatSetup {
  const encounter = registry.encounters[run.encounters[run.fight] ?? ''];
  if (!encounter) throw new Error(`Unknown encounter for fight ${run.fight}`);
  const setup: CombatSetup = {
    // Each fight's seed comes from the run, so a run replays exactly from its own seed.
    seed: run.seeds[run.fight] ?? 0,
    party: run.party,
    enemies: encounter.enemies,
    relics: run.relics,
    gauges: run.gauges,
  };
  if (run.hp !== null) setup.partyHp = run.hp;
  return setup;
}

/** Carries a finished fight back into the run: a loss ends it; a win offers relics, or wins the run after the last fight. */
export function finishFight(run: RunState, combat: CombatState, gauntlet: GauntletDef): RunState {
  if (combat.phase !== 'ended') throw new Error('The fight is not over.');
  const next = structuredClone(run);
  next.hp = combat.party.hp;
  next.gauges = combat.members.map((m) => m.gauge);
  if (combat.outcome === 'defeat') {
    next.phase = 'lost';
    return next;
  }
  if (run.fight >= gauntlet.steps.length - 1) {
    next.phase = 'won';
    return next;
  }
  const pool = gauntlet.relicPool.filter((id) => !run.relics.includes(id));
  shuffleInPlace(pool, next.rng, 'rewards');
  next.offered = pool.slice(0, gauntlet.offer);
  next.phase = next.offered.length > 0 ? 'reward' : 'fighting';
  if (next.phase === 'fighting') next.fight += 1;
  return next;
}

/** Takes one offered relic (or none) and moves on to the next fight. */
export function chooseRelic(run: RunState, relic: string | null): RunState {
  if (run.phase !== 'reward') throw new Error('Nothing is on offer.');
  if (relic !== null && !run.offered.includes(relic)) throw new Error(`"${relic}" was not offered.`);
  const next = structuredClone(run);
  if (relic !== null) next.relics.push(relic);
  next.offered = [];
  next.phase = 'fighting';
  next.fight += 1;
  return next;
}

/** The M2 test (owner, 19 Oct): two normal fights, then an elite; pick one relic of three after each win. */
export const M2_GAUNTLET: GauntletDef = {
  steps: [
    { pool: ['encounter.hound', 'encounter.roots-and-smoke', 'encounter.pods-and-lantern', 'encounter.two-hounds'] },
    { pool: ['encounter.hound', 'encounter.roots-and-smoke', 'encounter.pods-and-lantern', 'encounter.two-hounds'] },
    { pool: ['encounter.thorn-wall', 'encounter.hound-mother'] },
  ],
  relicPool: [
    'relic.brass-thimble',
    'relic.seed-packet',
    'relic.cracked-reliquary',
    'relic.vigil-wax',
    'relic.midwifes-shears',
    'relic.choir-bell',
    'relic.blooming-coin',
  ],
  offer: 3,
};
