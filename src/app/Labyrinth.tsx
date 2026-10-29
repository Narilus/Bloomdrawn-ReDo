import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { registry } from '../content/registry.ts';
import type { CombatState, RunCard } from '../engine/index.ts';
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
  chooseExpeditionCard,
  chooseExpeditionRelic,
  closeOutcome,
  describeChoice,
  eventHere,
  gambleStake,
  onBloomNode,
  rest,
  restHeal,
  runCardText,
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
import { BLOOM, plural, runBanking, type Banked, type Profile, type RunEnd } from '../game/profile.ts';
import type { RunSave } from '../save/run.ts';
import { CardFace, markNumber } from './CardView.tsx';
import { Combat } from './Combat.tsx';
import { RelicChoice } from './Gauntlet.tsx';
import { RelicBar } from './Hud.tsx';
import { LabyrinthMap, listOf } from './LabyrinthMap.tsx';
import type { Saves } from './saves.ts';

// The M3 run: walk the Labyrinth, fight where you stop, win at the Boss.

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
export const DEF = defFromUrl();
const SEED = Number(params().get('seed')) || undefined;
const FIRST_CLOCK = Number(params().get('clock')) || 0;
const FIRST_OBOLS = Number(params().get('obols')) || 0;

/** A new run for this party, front first, at its dupe levels, on a random board (or `?seed`'s), with its own ID for the profile to track. */
export function newRun(party: readonly string[], dupes: Readonly<Record<string, number>> = {}): RunSave {
  const seed = SEED ?? Math.floor(Math.random() * 2 ** 31);
  const exp = { ...startExpedition(seed, [...party], DEF, registry.motifs, dupes), clock: FIRST_CLOCK, obols: FIRST_OBOLS };
  return { id: crypto.randomUUID(), seed, exp };
}

interface Props {
  /** The run as last saved. Read once at mount; remount (change `key`) for another run. */
  initial: RunSave;
  saves: Saves;
  /** After a run has ended: start the next one. */
  onAgain: () => void;
  onTitle: () => void;
}

export function Labyrinth({ initial, saves, onAgain, onTitle }: Props) {
  const { id, seed } = initial;
  const [exp, setExp] = useState<Expedition>(initial.exp);
  const [walking, setWalking] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // The run is saved at every step it settles on, with the fight in progress if there is one. A
  // walk is saved at its end as soon as it starts, so closing the page mid-walk resumes there.
  const fight = useRef<CombatState | undefined>(initial.combat);
  const persist = useCallback((save: RunSave) => void saves.save(save).catch((err: unknown) => console.error('Saving the run failed', err)), [saves]);
  useEffect(() => {
    if (walking || exp.phase === 'won' || exp.phase === 'lost') return;
    persist({ id, seed, exp, ...(exp.phase === 'fight' && fight.current ? { combat: fight.current } : {}) });
  }, [exp, walking, id, seed, persist]);
  const onFightChange = useCallback(
    (combat: CombatState) => {
      fight.current = combat;
      persist({ id, seed, exp, combat });
    },
    [exp, id, seed, persist],
  );

  const pick = (key: string) => {
    if (walking) return;
    const states = move(exp, key, DEF, registry);
    if (!states) return;
    persist({ id, seed, exp: states.at(-1)! });
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

  // A run that ends banks its Blooms once and its save is dropped; the ref keeps a remounted
  // effect from banking it again. Abandoning banks from the menu.
  const [abandoned, setAbandoned] = useState(false);
  const [menu, setMenu] = useState<'closed' | 'open' | 'abandon'>('closed');
  const [profile, setProfile] = useState<Profile | 'failed' | null>(null);
  const banked = useRef<Expedition | null>(null);
  const end = useCallback(
    (ended: Expedition, how: RunEnd) => {
      if (banked.current === ended) return;
      banked.current = ended;
      setProfile(null);
      saves.end(runBanking(ended, how, DEF)).then(setProfile, (err: unknown) => {
        console.error('Banking failed', err);
        setProfile('failed');
      });
    },
    [saves],
  );
  useEffect(() => {
    if (exp.phase === 'won' || exp.phase === 'lost') end(exp, exp.phase);
  }, [exp, end]);
  const abandon = () => {
    setMenu('closed');
    setAbandoned(true);
    end(exp, 'abandoned');
  };
  const onFightEnd = useCallback((combat: CombatState) => {
    fight.current = undefined;
    setExp((e) => finishExpeditionFight(e, combat, DEF, registry));
  }, []);
  const result: RunEnd | undefined = abandoned ? 'abandoned' : exp.phase === 'won' || exp.phase === 'lost' ? exp.phase : undefined;

  const tile = exp.board.tiles[exp.board.at];
  const maxHp = expeditionMaxHp(exp, registry);
  if (exp.phase === 'fight' && !walking) {
    // Only the fight the run was saved in resumes; any later one starts fresh.
    const resumed = initial.combat && initial.exp.fightSeed === exp.fightSeed ? initial.combat : undefined;
    const label = tile?.kind === 'boss' ? 'Boss' : tile?.kind === 'elite' ? 'Elite' : tile?.kind === 'bloom' ? 'Bloom node' : 'Labyrinth';
    return (
      <Combat
        key={`${seed}:${exp.fightSeed}`}
        setup={expeditionFight(exp, registry)}
        {...(resumed ? { resume: resumed } : {})}
        label={label}
        onChange={onFightChange}
        onEnd={onFightEnd}
      />
    );
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
      {exp.deck.length > 0 && <RunDeck exp={exp} />}
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
      {exp.phase === 'reward' &&
        (exp.offeredCards.length > 0 ? (
          <CardChoice offered={exp.offeredCards} dupes={exp.dupes} onChoose={(index) => setExp(chooseExpeditionCard(exp, index))}>
            <Spoils exp={exp} />
          </CardChoice>
        ) : (
          <RelicChoice offered={exp.offered} onChoose={(relic) => setExp(chooseExpeditionRelic(exp, relic))}>
            <Spoils exp={exp} />
          </RelicChoice>
        ))}
      {!result && exp.phase === 'map' && !walking && (
        <button className="map-menu plaque" onClick={() => setMenu('open')}>
          Menu
        </button>
      )}
      {menu === 'open' && !result && (
        <div className="result reward" role="dialog" aria-label="Menu">
          <h2 className="panel-title">The run is saved</h2>
          <p className="result-line">Leave it here and Continue from the title screen whenever you like.</p>
          <div className="panel-buttons">
            <button className="end-turn" onClick={() => setMenu('closed')}>
              Keep playing
            </button>
            <button className="end-turn" onClick={onTitle}>
              Title screen
            </button>
            <button className="ghost" onClick={() => setMenu('abandon')}>
              Abandon run
            </button>
          </div>
        </div>
      )}
      {menu === 'abandon' && !result && (
        <div className="result reward" role="dialog" aria-label="Abandon run">
          <h2 className="panel-title">Abandon this run?</h2>
          <p className="result-line">It ends here and banks only its share:</p>
          <Banking banked={runBanking(exp, 'abandoned', DEF)} profile={undefined} />
          <div className="panel-buttons">
            <button className="end-turn" onClick={() => setMenu('closed')}>
              Keep playing
            </button>
            <button className="ghost" onClick={abandon}>
              Abandon
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="result">
          <h2>{result === 'won' ? 'The Labyrinth cleared' : result === 'lost' ? 'Defeat' : 'Run abandoned'}</h2>
          <p className="result-line">
            {result === 'won' ? `The Boss falls with ${exp.hp} HP left.` : result === 'lost' ? 'The Bloom keeps the expedition.' : 'The expedition turns back.'}
          </p>
          <Banking banked={runBanking(exp, result, DEF)} profile={profile} />
          <div className="panel-buttons">
            <button className="end-turn" onClick={onAgain} disabled={profile === null}>
              Run again
            </button>
            <button className="end-turn" onClick={onTitle} disabled={profile === null}>
              Title screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What a run banks and why, and once it has ended, the profile's Purified Blooms when they are saved. */
export function Banking({ banked, profile }: { banked: Banked; profile: Profile | 'failed' | null | undefined }) {
  return (
    <div className="banking" aria-label="Banked">
      <ul>
        {banked.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="banked-total">This run: {plural(banked.pulls, BLOOM)}</p>
      {profile !== undefined && (
        <p className="banked-profile">
          {profile === 'failed' ? 'The profile could not be saved.' : profile ? `${BLOOM}s banked in all: ${profile.pulls}` : 'Banking…'}
        </p>
      )}
    </div>
  );
}

/** The cards the run has gained, each listed once with its owner (or as a Symptom) and how many the deck holds. */
function RunDeck({ exp }: { exp: Expedition }) {
  const key = (c: RunCard) => `${c.card}|${c.owner ?? ''}`;
  const rows = [...new Map(exp.deck.map((c) => [key(c), c])).values()];
  return (
    <div className="map-deck plaque" aria-label="Run deck">
      <div className="map-deck-head">
        <span>Run deck</span>
        <strong>{exp.deck.length}</strong>
      </div>
      <ul>
        {rows.map((c) => (
          <li key={key(c)} className={c.owner ? undefined : 'symptom'} title={c.owner ? runCardText(c, registry, {}, exp.dupes) : symptomText(exp, c.card, registry)}>
            <span>{registry.cards[c.card]?.name ?? c.card}</span>
            <span className="owner">{c.owner ? registry.characters[c.owner]?.name : 'Symptom'}</span>
            <span className="count">×{exp.deck.filter((d) => key(d) === key(c)).length}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a won fight gave, on the Victory panel. */
function Spoils({ exp }: { exp: Expedition }) {
  if (!exp.spoils) return null;
  return (
    <p className="spoils">
      <strong>+{exp.spoils.obols} Obols</strong>
      {exp.spoils.bonus > 0 && (
        <span className="muted">
          {' '}
          including +{exp.spoils.bonus}% from the Bloom at {BLOOM_STAGES.find((s) => s.id === exp.spoils!.stage)?.name}
        </span>
      )}
    </p>
  );
}

/** A normal fight's card pick: each card shows the member it goes to and her numbers. */
function CardChoice({
  offered,
  dupes,
  onChoose,
  children,
}: {
  offered: readonly RunCard[];
  /** The run's dupe levels, for the owners' numbers. */
  dupes: Expedition['dupes'];
  onChoose: (index: number | null) => void;
  children?: ReactNode;
}) {
  return (
    <div className="result reward" role="dialog" aria-label="Victory">
      <h2>Victory</h2>
      {children}
      <p className="result-line">Choose a card. It joins the deck for the rest of the run.</p>
      <div className="card-offers">
        {offered.map((c, i) => {
          const def = registry.cards[c.card];
          const owner = registry.characters[c.owner ?? ''];
          return (
            <button key={i} className="card-offer" aria-label={`${def?.name ?? c.card} for ${owner?.name}`} onClick={() => onChoose(i)}>
              <CardFace
                id={c.card}
                def={def}
                owner={owner}
                text={runCardText(c, registry, { charge: false, keywords: false, mark: markNumber }, dupes)}
                cost={def?.cost}
                registry={registry}
                playable
              />
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
