import { useCallback, useEffect, useRef, useState } from 'react';
import { registry } from '../content/registry.ts';
import type { CombatState } from '../engine/index.ts';
import { BLOOM_STAGES, bossDirection, stageOf, ticksToNext } from '../game/bloom.ts';
import {
  canMove,
  chooseExpeditionRelic,
  expeditionFight,
  finishExpeditionFight,
  leaveTile,
  M3_EXPEDITION,
  move,
  startExpedition,
  turnBack,
  type Expedition,
  type ExpeditionDef,
} from '../game/expedition.ts';
import { Combat } from './Combat.tsx';
import { RelicChoice } from './Gauntlet.tsx';
import { RelicBar } from './Hud.tsx';
import { LabyrinthMap } from './LabyrinthMap.tsx';

// The M3 run: walk the Labyrinth, fight where you stop, win at the Boss.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
/** Seconds per tile as the party token walks its route. */
const STEP = 0.22;
/** A beat on arriving at a fight before the battlefield takes over. */
const FIGHT_BEAT = 0.45;

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());

/**
 * Dev builds only: `?seed=N` picks the board; `?encounters=id,...` replaces every fight, elite and
 * Boss pool (e2e uses training dummies); `?clock=N` starts the Bloom clock at N ticks.
 */
function defFromUrl(): ExpeditionDef {
  const encounters = (params().get('encounters')?.split(',') ?? []).filter((id) => registry.encounters[id]);
  if (encounters.length === 0) return M3_EXPEDITION;
  return { ...M3_EXPEDITION, board: { ...M3_EXPEDITION.board, encounters: { fight: encounters, elite: encounters, boss: encounters } } };
}
const DEF = defFromUrl();
const FIRST_SEED = Number(params().get('seed')) || 1;
const FIRST_CLOCK = Number(params().get('clock')) || 0;
const begin = (seed: number): Expedition => ({ ...startExpedition(seed, PARTY, DEF, registry.motifs), clock: FIRST_CLOCK });
const maxHp = PARTY.reduce((sum, id) => sum + (registry.characters[id]?.stats.hp ?? 0), 0);

export function Labyrinth() {
  const [seed, setSeed] = useState(FIRST_SEED);
  const [exp, setExp] = useState<Expedition>(() => begin(FIRST_SEED));
  const [walking, setWalking] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const pick = (key: string) => {
    if (walking) return;
    const states = move(exp, key);
    if (!states) return;
    setWalking(true);
    states.forEach((state, i) => {
      const last = i === states.length - 1;
      timers.current.push(window.setTimeout(() => setExp(state), (i + 1) * STEP * 1000));
      if (last) {
        const beat = state.phase === 'fight' ? FIGHT_BEAT : 0;
        timers.current.push(window.setTimeout(() => setWalking(false), ((i + 1) * STEP + beat) * 1000));
      }
    });
  };
  const onFightEnd = useCallback((combat: CombatState) => setExp((e) => finishExpeditionFight(e, combat, DEF)), []);
  const again = () => {
    setSeed(seed + 1);
    setExp(begin(seed + 1));
  };

  const tile = exp.board.tiles[exp.board.at];
  if (exp.phase === 'fight' && !walking) {
    const label = tile?.kind === 'boss' ? 'Boss' : tile?.kind === 'elite' ? 'Elite' : tile?.kind === 'pod' ? 'Pod' : 'Labyrinth';
    return <Combat key={`${seed}:${exp.fightSeed}`} setup={expeditionFight(exp, registry)} label={label} onEnd={onFightEnd} />;
  }

  return (
    <div className={`labyrinth bloom-${stageOf(exp.clock).id}`}>
      <LabyrinthMap board={exp.board} busy={walking || !canMove(exp)} boss={bossDirection(exp.board, exp.clock)} onPick={pick} />
      <RelicBar relics={exp.relics} />
      <BloomClock clock={exp.clock} />
      <div className="map-party plaque">
        <div className="bar-label">
          <span>Party</span>
          <strong>
            {exp.hp ?? maxHp} / {maxHp}
          </strong>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${((exp.hp ?? maxHp) / maxHp) * 100}%` }} />
        </div>
      </div>
      {exp.phase === 'tile' && !walking && <TilePanel exp={exp} onChange={setExp} />}
      {exp.phase === 'reward' && <RelicChoice offered={exp.offered} onChoose={(relic) => setExp(chooseExpeditionRelic(exp, relic))} />}
      {(exp.phase === 'won' || exp.phase === 'lost') && (
        <div className="result">
          <h2>{exp.phase === 'won' ? 'The Labyrinth cleared' : 'Defeat'}</h2>
          <p className="result-line">{exp.phase === 'won' ? `The Boss falls with ${exp.hp} HP left.` : 'The Bloom keeps the expedition.'}</p>
          <button className="end-turn" onClick={again}>
            Run again
          </button>
        </div>
      )}
    </div>
  );
}

/** The Bloom clock: its stage, the ticks toward the next one, and what the stage does. */
function BloomClock({ clock }: { clock: number }) {
  const stage = stageOf(clock);
  const left = ticksToNext(clock);
  const span = left === undefined ? 0 : left + clock - stage.from;
  const effect = stage.id === 'fruiting' ? 'Pods swell near you with every tick' : stage.id === 'flowering' ? 'The Boss shows its way' : '';
  return (
    <div className="bloom-clock plaque" aria-label={`Bloom clock: ${stage.name}`}>
      <div className="bar-label">
        <span>Bloom</span>
        <strong>{stage.name}</strong>
      </div>
      {span > 0 && (
        <div className="bloom-pips" title={`${left} more ${left === 1 ? 'tick' : 'ticks'} to ${BLOOM_STAGES.find((s) => s.from === clock + left!)?.name}`}>
          {Array.from({ length: span }, (_, i) => (
            <span key={i} className={i < clock - stage.from ? 'pip filled' : 'pip'} />
          ))}
        </div>
      )}
      <span className="muted">{stage.enemyScale > 0 ? `Enemies +${stage.enemyScale}% HP and damage` : 'Fights, Events and Camps tick it'}</span>
      {effect && <span className="muted">{effect}</span>}
    </div>
  );
}

/** Standing on a Shop, Camp, Event or Symptom. Their rules arrive in M3.5–M3.6. */
function TilePanel({ exp, onChange }: { exp: Expedition; onChange: (exp: Expedition) => void }) {
  const tile = exp.board.tiles[exp.board.at]!;
  const back = turnBack(exp);
  const text: Partial<Record<typeof tile.kind, { title: string; body: string; leave: string }>> = {
    shop: { title: 'Shop', body: 'Stock and buying arrive in M3.5. The Shop stays here.', leave: 'Leave' },
    camp: { title: 'Camp', body: 'Resting arrives in M3.6. The Camp stays here until used.', leave: 'Leave' },
    event: { title: 'Event', body: 'Events are written in M3.6. This one is used up.', leave: 'Continue' },
    symptom: { title: 'Symptom', body: 'Taking its card to pass arrives in M3.6. For now, passing is free once taken.', leave: 'Take it and pass' },
  };
  const t = text[tile.kind];
  if (!t) return null;
  return (
    <div className="tile-panel plaque" role="dialog" aria-label={t.title}>
      <h3>{t.title}</h3>
      <p>{t.body}</p>
      <div className="tile-actions">
        <button className="end-turn" onClick={() => onChange(leaveTile(exp, DEF))}>
          {t.leave}
        </button>
        {tile.kind === 'symptom' && back && (
          <button className="ghost" onClick={() => onChange(back)}>
            Turn back
          </button>
        )}
      </div>
    </div>
  );
}
