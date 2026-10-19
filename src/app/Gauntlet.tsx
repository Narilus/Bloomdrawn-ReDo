import { useCallback, useState } from 'react';
import { registry } from '../content/registry.ts';
import type { CombatSetup, CombatState } from '../engine/index.ts';
import { chooseRelic, fightSetup, finishFight, M2_GAUNTLET, startRun, type GauntletDef, type RunState } from '../game/run.ts';
import { Combat } from './Combat.tsx';

// The starter four, Agathe in front.
const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());
const ids = (key: string) => params().get(key)?.split(',').filter(Boolean) ?? [];

/**
 * Dev builds only (a first piece of the content lab):
 * - `?fights=encounter,...` replaces the gauntlet's encounters, one per fight;
 * - `?enemies=id,...` and `?relics=id,...` play a single test fight instead, gauges at 70.
 */
function gauntletFromUrl(): GauntletDef {
  const fights = ids('fights').filter((id) => registry.encounters[id]);
  return fights.length > 0 ? { ...M2_GAUNTLET, steps: fights.map((id) => ({ pool: [id] })) } : M2_GAUNTLET;
}

function testFightFromUrl(): CombatSetup | null {
  const enemies = ids('enemies').filter((id) => registry.enemies[id]);
  const relics = ids('relics').filter((id) => registry.relics[id]);
  if (enemies.length === 0 && relics.length === 0) return null;
  return { seed: 1, party: PARTY, enemies: enemies.length > 0 ? enemies : ['enemy.bloom-rib-hound'], relics, gauges: PARTY.map(() => 70) };
}

const GAUNTLET = gauntletFromUrl();
const TEST_FIGHT = testFightFromUrl();

/** The M2 gauntlet: three fights with a relic pick after each win. HP, gauges and relics carry over. */
export function Gauntlet() {
  return TEST_FIGHT ? <TestFight setup={TEST_FIGHT} /> : <Run />;
}

function Run() {
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<RunState>(() => startRun(1, PARTY, GAUNTLET));
  const onEnd = useCallback((combat: CombatState) => setRun((r) => finishFight(r, combat, GAUNTLET)), []);
  const again = () => {
    setSeed(seed + 1);
    setRun(startRun(seed + 1, PARTY, GAUNTLET));
  };
  const tier = registry.encounters[run.encounters[run.fight] ?? '']?.tier;
  const label = `Fight ${run.fight + 1} of ${GAUNTLET.steps.length}${tier === 'elite' ? ' · Elite' : ''}`;
  return (
    <>
      <Combat key={`${seed}:${run.fight}`} setup={fightSetup(run, registry)} label={label} onEnd={onEnd} />
      {run.phase === 'reward' && <RelicChoice run={run} onChoose={(relic) => setRun(chooseRelic(run, relic))} />}
      {(run.phase === 'won' || run.phase === 'lost') && (
        <div className="result">
          <h2>{run.phase === 'won' ? 'Gauntlet cleared' : 'Defeat'}</h2>
          <p className="result-line">
            {run.phase === 'won'
              ? `All ${GAUNTLET.steps.length} fights won with ${run.hp} HP left.`
              : `Fell in fight ${run.fight + 1} of ${GAUNTLET.steps.length}.`}
          </p>
          <button className="end-turn" onClick={again}>
            Run again
          </button>
        </div>
      )}
    </>
  );
}

/** Pick one relic of those offered, or none. */
function RelicChoice({ run, onChoose }: { run: RunState; onChoose: (relic: string | null) => void }) {
  return (
    <div className="result reward">
      <h2>Victory</h2>
      <p className="result-line">Choose a relic. It lasts the rest of the run.</p>
      <div className="relic-offers">
        {run.offered.map((id) => {
          const def = registry.relics[id];
          return (
            <button key={id} className={`relic-offer plaque tier-${def?.tier ?? 'common'}`} onClick={() => onChoose(id)}>
              <h3>{def?.name ?? id}</h3>
              <span className="tier-line">{def?.tier}</span>
              <p>{def?.text}</p>
            </button>
          );
        })}
      </div>
      <button className="ghost" onClick={() => onChoose(null)}>
        Take nothing
      </button>
    </div>
  );
}

/** A single dev fight from the URL, with "Fight again". */
function TestFight({ setup }: { setup: CombatSetup }) {
  const [round, setRound] = useState(0);
  const [ended, setEnded] = useState<CombatState | null>(null);
  const onEnd = useCallback((combat: CombatState) => setEnded(combat), []);
  return (
    <>
      <Combat key={round} setup={{ ...setup, seed: setup.seed + round }} label="Test fight" onEnd={onEnd} />
      {ended && (
        <div className="result">
          <h2>{ended.outcome === 'victory' ? 'Victory' : 'Defeat'}</h2>
          <button
            className="end-turn"
            onClick={() => {
              setEnded(null);
              setRound(round + 1);
            }}
          >
            Fight again
          </button>
        </div>
      )}
    </>
  );
}
