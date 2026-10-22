import { useCallback, useEffect, useRef, useState } from 'react';
import { registry } from '../content/registry.ts';
import type { CombatState } from '../engine/index.ts';
import { BLOOM_NODES, BLOOM_STAGES, bossDirection, reached, stageOf, ticksToNext } from '../game/bloom.ts';
import {
  buyRelic,
  canMove,
  cannotBuy,
  cannotChoose,
  cannotMend,
  cannotRest,
  chooseBloom,
  chooseEvent,
  chooseExpeditionRelic,
  closeOutcome,
  describeChoice,
  eventHere,
  gambleStake,
  onBloomNode,
  rest,
  restHeal,
  symptomText,
  takeSymptom,
  expeditionFight,
  expeditionMaxHp,
  finishExpeditionFight,
  leaveTile,
  M3_EXPEDITION,
  mend,
  mendHeal,
  move,
  shopHere,
  startExpedition,
  turnBack,
  type Expedition,
  type ExpeditionDef,
  type Outcome,
  type ShopStock,
} from '../game/expedition.ts';
import { Combat } from './Combat.tsx';
import { RelicChoice } from './Gauntlet.tsx';
import { RelicBar } from './Hud.tsx';
import { LabyrinthMap, listOf } from './LabyrinthMap.tsx';

// The M3 run: walk the Labyrinth, fight where you stop, win at the Boss.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
/** Seconds per tile as the party token walks its route. */
const STEP = 0.22;
/** A beat on arriving at a fight before the battlefield takes over. */
const FIGHT_BEAT = 0.45;

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());

/**
 * Dev builds only: `?seed=N` picks the board; `?encounters=id,...` replaces every fight, elite and
 * Boss pool (e2e uses training dummies); `?clock=N` starts the Bloom clock at N ticks; `?obols=N`
 * starts with N Obols.
 */
function defFromUrl(): ExpeditionDef {
  const encounters = (params().get('encounters')?.split(',') ?? []).filter((id) => registry.encounters[id]);
  if (encounters.length === 0) return M3_EXPEDITION;
  return { ...M3_EXPEDITION, board: { ...M3_EXPEDITION.board, encounters: { fight: encounters, elite: encounters, boss: encounters } } };
}
const DEF = defFromUrl();
const FIRST_SEED = Number(params().get('seed')) || 1;
const FIRST_CLOCK = Number(params().get('clock')) || 0;
const FIRST_OBOLS = Number(params().get('obols')) || 0;
const begin = (seed: number): Expedition => ({ ...startExpedition(seed, PARTY, DEF, registry.motifs), clock: FIRST_CLOCK, obols: FIRST_OBOLS });

export function Labyrinth() {
  const [seed, setSeed] = useState(FIRST_SEED);
  const [exp, setExp] = useState<Expedition>(() => begin(FIRST_SEED));
  const [walking, setWalking] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const pick = (key: string) => {
    if (walking) return;
    const states = move(exp, key, DEF, registry);
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
  const maxHp = expeditionMaxHp(exp, registry);
  if (exp.phase === 'fight' && !walking) {
    const label = tile?.kind === 'boss' ? 'Boss' : tile?.kind === 'elite' ? 'Elite' : tile?.kind === 'bloom' ? 'Bloom node' : 'Labyrinth';
    return <Combat key={`${seed}:${exp.fightSeed}`} setup={expeditionFight(exp, registry)} label={label} onEnd={onFightEnd} />;
  }

  return (
    <div className={`labyrinth bloom-${stageOf(exp.clock).id}`}>
      <LabyrinthMap board={exp.board} busy={walking || !canMove(exp)} boss={bossDirection(exp.board, exp.clock)} onPick={pick} />
      <RelicBar relics={exp.relics} />
      <BloomClock clock={exp.clock} />
      <div className="map-obols plaque" aria-label="Obols">
        <span>Obols</span>
        <strong>{exp.obols}</strong>
      </div>
      {exp.deck.length > 0 && (
        <div className="map-deck plaque" aria-label="Symptoms">
          <div className="map-deck-head">
            <span>Symptoms</span>
            <strong>{exp.deck.length}</strong>
          </div>
          <ul>
            {[...new Set(exp.deck)].map((id) => (
              <li key={id} title={symptomText(exp, id, registry)}>
                <span>{registry.cards[id]?.name ?? id}</span>
                <span className="count">×{exp.deck.filter((d) => d === id).length}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      {exp.phase === 'outcome' && exp.outcome && <OutcomePanel outcome={exp.outcome} onClose={() => setExp(closeOutcome(exp))} />}
      {exp.phase === 'reward' && (
        <RelicChoice offered={exp.offered} onChoose={(relic) => setExp(chooseExpeditionRelic(exp, relic))}>
          {exp.spoils && (
            <p className="spoils">
              <strong>+{exp.spoils.obols} Obols</strong>
              {exp.spoils.bonus > 0 && (
                <span className="muted">
                  {' '}
                  including +{exp.spoils.bonus}% from the Bloom at {BLOOM_STAGES.find((s) => s.id === exp.spoils!.stage)?.name}
                </span>
              )}
            </p>
          )}
        </RelicChoice>
      )}
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
  const effects = [...(reached(clock, 'flowering') ? ['The Boss shows its way'] : []), ...(reached(clock, 'fruiting') ? ['Bloom nodes swell on the path'] : [])];
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
      {effects.map((effect) => (
        <span key={effect} className="muted">
          {effect}
        </span>
      ))}
    </div>
  );
}

/** Standing on a Shop, Camp, Event, Symptom or Bloom node. */
function TilePanel({ exp, onChange }: { exp: Expedition; onChange: (exp: Expedition) => void }) {
  const tile = exp.board.tiles[exp.board.at]!;
  const stock = shopHere(exp);
  const event = eventHere(exp, registry);
  if (stock) return <ShopPanel exp={exp} stock={stock} onChange={onChange} />;
  if (event) {
    return (
      <div className="tile-panel event-panel plaque" role="dialog" aria-label={event.name}>
        <h3>{event.name}</h3>
        <p>{event.text}</p>
        <div className="choices">
          {event.choices.map((choice, i) => {
            const why = cannotChoose(exp, i, DEF, registry);
            return (
              <button key={choice.label} className="choice" disabled={why !== undefined} title={why} onClick={() => onChange(chooseEvent(exp, i, DEF, registry))}>
                <strong>{choice.label}</strong>
                <span>{describeChoice(exp, choice, registry).join(' ')}</span>
                {why && <span className="why">{why}</span>}
              </button>
            );
          })}
        </div>
        <p className="muted">Choosing ticks the Bloom clock.</p>
      </div>
    );
  }
  if (onBloomNode(exp)) {
    const encounter = registry.encounters[tile.content ?? ''];
    const enemies = listOf(encounter?.enemies.map((e) => registry.enemies[typeof e === 'string' ? e : e.enemy]?.name ?? '?') ?? []);
    const stake = gambleStake(exp, registry);
    return (
      <div className="tile-panel event-panel plaque" role="dialog" aria-label="Bloom node">
        <h3>Bloom node</h3>
        <p>The Bloom has swollen across the path. Choose one; the node is used up.</p>
        <div className="choices">
          <button className="choice" onClick={() => onChange(chooseBloom(exp, 'fight', registry))}>
            <strong>Fight</strong>
            <span>{enemies}</span>
          </button>
          <button className="choice" onClick={() => onChange(chooseBloom(exp, 'gamble', registry))}>
            <strong>Gamble</strong>
            <span>
              Even odds: lose {stake} HP or heal {stake} HP, up to full ({BLOOM_NODES.gamble}% of current).
            </span>
          </button>
          <button className="choice" onClick={() => onChange(chooseBloom(exp, 'symptom', registry))}>
            <strong>Take the Symptom</strong>
            {tile.card && <SymptomFace exp={exp} card={tile.card} />}
          </button>
        </div>
      </div>
    );
  }
  if (tile.kind === 'symptom' && tile.card) {
    const back = turnBack(exp);
    return (
      <div className="tile-panel plaque" role="dialog" aria-label="Symptom">
        <h3>Symptom</h3>
        <p>Take its card to pass. It joins the deck for the rest of the run.</p>
        <SymptomFace exp={exp} card={tile.card} />
        <div className="tile-actions">
          <button className="end-turn" onClick={() => onChange(takeSymptom(exp))}>
            Take it and pass
          </button>
          {back && (
            <button className="ghost" onClick={() => onChange(back)}>
              Turn back
            </button>
          )}
        </div>
      </div>
    );
  }
  if (tile.kind === 'camp') {
    const why = cannotRest(exp, DEF, registry);
    const heal = restHeal(exp, DEF, registry);
    return (
      <div className="tile-panel plaque" role="dialog" aria-label="Camp">
        <h3>Camp</h3>
        <p>
          Rest: heal {DEF.camp.percent}% of max HP{heal > 0 ? ` (${heal} HP)` : ''}. Resting ticks the Bloom clock and uses the Camp up. Leave to keep it for later.
        </p>
        <div className="tile-actions">
          <button className="end-turn" disabled={why !== undefined} title={why} onClick={() => onChange(rest(exp, DEF, registry))}>
            Rest
          </button>
          <button className="ghost" onClick={() => onChange(leaveTile(exp))}>
            Leave
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/** A Symptom card as the map shows it, with its HP costs for the party as it stands. */
function SymptomFace({ exp, card }: { exp: Expedition; card: string }) {
  const def = registry.cards[card];
  return (
    <div className="symptom-face">
      <span className="symptom-cost">{def?.cost}</span>
      <strong>{def?.name ?? card}</strong>
      <span>{symptomText(exp, card, registry)}</span>
    </div>
  );
}

/** What an Event or Bloom node choice did, before the map returns. */
function OutcomePanel({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  const lines: string[] = [];
  if (outcome.obols) lines.push(outcome.obols > 0 ? `+${outcome.obols} Obols` : `${-outcome.obols} Obols spent`);
  if (outcome.relic) lines.push(`Relic: ${registry.relics[outcome.relic]?.name ?? outcome.relic}`);
  if (outcome.hp !== undefined) lines.push(outcome.hp >= 0 ? `Healed ${outcome.hp} HP` : `Lost ${-outcome.hp} HP`);
  if (outcome.charge) lines.push(`+${outcome.charge} ultimate charge for every member`);
  if (outcome.card) lines.push(`${registry.cards[outcome.card]?.name ?? outcome.card} joins the deck`);
  if (outcome.ticks) lines.push(`The Bloom clock ticks ${outcome.ticks === 1 ? 'once' : `${outcome.ticks} times`}`);
  if (lines.length === 0) lines.push('Nothing happens.');
  return (
    <div className="tile-panel plaque" role="dialog" aria-label="Outcome">
      <h3>{outcome.event ? (registry.events[outcome.event]?.name ?? outcome.event) : 'Bloom node'}</h3>
      <ul className="outcome-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="tile-actions">
        <button className="end-turn" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}

/** A Shop: one relic of each tier and Mend, at prices fixed all run. Nothing can be sold. */
function ShopPanel({ exp, stock, onChange }: { exp: Expedition; stock: ShopStock; onChange: (exp: Expedition) => void }) {
  const mendWhy = cannotMend(exp, registry);
  return (
    <div className="tile-panel shop-panel plaque" role="dialog" aria-label="Shop">
      <h3>Shop</h3>
      <p className="muted">Its stock and prices stay all run.</p>
      <div className="shop-relics">
        {stock.relics.map((offer) => {
          const def = registry.relics[offer.relic];
          const why = cannotBuy(exp, offer.relic);
          const label = offer.sold ? 'Sold' : exp.relics.includes(offer.relic) ? 'Owned' : `Buy · ${offer.price}`;
          return (
            <div key={offer.relic} className={`shop-item plaque tier-${def?.tier ?? 'common'}${offer.sold ? ' sold' : ''}`}>
              <h4>{def?.name ?? offer.relic}</h4>
              <span className="tier-line">{def?.tier}</span>
              <p>{def?.text}</p>
              <button className="buy" disabled={why !== undefined} title={why} onClick={() => onChange(buyRelic(exp, offer.relic))}>
                {label}
              </button>
            </div>
          );
        })}
      </div>
      <div className="shop-service">
        <div>
          <strong>Mend</strong>
          <span className="muted">
            {' '}
            Heal {stock.mend.percent}% of max HP{!stock.mend.used && mendHeal(exp, registry) > 0 ? ` (${mendHeal(exp, registry)} HP)` : ''}. Once per Shop.
          </span>
        </div>
        <button className="buy" disabled={mendWhy !== undefined} title={mendWhy} onClick={() => onChange(mend(exp, registry))}>
          {stock.mend.used ? 'Used' : `Mend · ${stock.mend.price}`}
        </button>
      </div>
      <div className="tile-actions">
        <button className="end-turn" onClick={() => onChange(leaveTile(exp))}>
          Leave
        </button>
      </div>
    </div>
  );
}
