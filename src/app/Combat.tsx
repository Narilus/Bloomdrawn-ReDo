import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registry } from '../content/registry.ts';
import { apply, GAUGE_MAX, previewCard, startCombat, type CombatState, type Command, type EntityId, type Vitals } from '../engine/index.ts';
import type { Battlefield } from '../stage/Battlefield.ts';
import { StageView } from '../stage/StageView.tsx';
import { useFrame } from './Frame.tsx';
import { Hand, type Aim } from './Hand.tsx';
import { DomainCounters, EnemyPlate, PartyBar, Pile, Portraits, UltimatePanel } from './Hud.tsx';

// Slice line-up: the starter four with their picked Bloomdrawn sprites, Agathe in front.
const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
// The M1 fight: the starter four against one Bloom-Rib Hound.
const DEFAULT_ENEMIES = ['enemy.bloom-rib-hound'];

/** Dev builds only: `?enemies=id,id` picks the enemies (a first piece of the content lab). */
function enemiesFromUrl(): string[] {
  if (!import.meta.env.DEV) return DEFAULT_ENEMIES;
  const ids = new URLSearchParams(window.location.search).get('enemies')?.split(',') ?? [];
  return ids.length > 0 && ids.every((id) => registry.enemies[id]) ? ids : DEFAULT_ENEMIES;
}
const ENEMIES = enemiesFromUrl();

// Every gauge starts at 70, as if mid-run, so each ultimate can fire in one slice fight (DECISIONS.md).
const GAUGES = PARTY.map(() => 70);

const newCombat = (seed: number) => startCombat({ seed, party: PARTY, enemies: ENEMIES, gauges: GAUGES }, registry).state;

export function Combat() {
  const { fit, stageHost } = useFrame();
  const [seed, setSeed] = useState(1);
  const [state, setState] = useState(() => newCombat(1));
  // The source of truth between renders, so rapid input never applies a command to a stale state.
  const current = useRef(state);
  const field = useRef<Battlefield | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [banner, setBanner] = useState<{ text: string; id: number } | null>(null);
  const [ultimateFor, setUltimateFor] = useState<EntityId | null>(null);
  // While the end of turn and enemy actions play out, the hand waits.
  const [busy, setBusy] = useState(false);
  // HP and Shield as the battlefield shows them: they step with each hit as it lands.
  const [shown, setShown] = useState<Vitals | null>(null);
  const timers = useRef<number[]>([]);

  const run = useCallback((command: Command) => {
    const before = current.current;
    const result = apply(before, command, registry);
    if (!result.ok) {
      setToast({ text: result.reason, id: Date.now() });
      return false;
    }
    current.current = result.state;
    setState(result.state);
    const { times, duration } = field.current?.play(result.events) ?? { times: [], duration: 0 };
    // A new command finishes the previous sequence's bars at once, then steps through its own.
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setShown(vitalsOf(before));
    times.forEach((t, i) => {
      if (times[i + 1] === t) return; // only the last event at each moment
      timers.current.push(window.setTimeout(() => setShown(result.vitals[i] ?? null), t * 1000));
    });
    timers.current.push(window.setTimeout(() => setShown(null), duration * 1000 + 100));
    if (command.type === 'endTurn' && duration > 0 && result.state.phase === 'player') {
      setBusy(true);
      timers.current.push(window.setTimeout(() => setBusy(false), duration * 1000 + 250));
    }
    const fired = result.events.find((e) => e.type === 'ultimateFired');
    const member = fired && result.state.members.find((m) => m.id === fired.source);
    const ultimate = member && registry.characters[member.character]?.ultimate;
    if (ultimate) setBanner({ text: ultimate.name, id: Date.now() });
    return true;
  }, []);

  const onPlay = useCallback(
    (card: EntityId, target?: EntityId) => run(target ? { type: 'playCard', card, target } : { type: 'playCard', card }),
    [run],
  );
  const endTurn = useCallback(() => {
    if (!busy) run({ type: 'endTurn' });
  }, [run, busy]);
  const fireUltimate = useCallback(() => {
    if (ultimateFor) run({ type: 'fireUltimate', member: ultimateFor });
    setUltimateFor(null);
  }, [run, ultimateFor]);
  const closeUltimate = useCallback(() => setUltimateFor(null), []);
  const restart = () => {
    const next = seed + 1;
    const fresh = newCombat(next);
    current.current = fresh;
    setSeed(next);
    setState(fresh);
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setShown(null);
    setBusy(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || ultimateFor) return;
      if (e.key === 'e' || e.key === 'E') endTurn();
      // Shift + 1–4 opens that party member's ultimate when it is ready.
      const slot = e.shiftKey && /^Digit[1-4]$/.test(e.code) ? Number(e.code.slice(5)) - 1 : -1;
      const member = current.current.members[slot];
      if (member && member.gauge >= GAUGE_MAX) setUltimateFor(member.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [endTurn, busy, ultimateFor]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 1500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  // Dev and e2e only: lets the settle check read actor positions.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __bloomdrawn?: unknown }).__bloomdrawn = { actors: () => field.current?.snapshot() ?? [] };
  }, []);

  const handOpen = state.phase === 'player' && !busy && !ultimateFor;
  const readied = handOpen ? aim : null;
  const previews = useMemo(() => {
    if (!readied) return [];
    const command = readied.target
      ? { type: 'playCard' as const, card: readied.card, target: readied.target }
      : { type: 'playCard' as const, card: readied.card };
    return previewCard(state, command, registry) ?? [];
  }, [readied, state]);

  const onReady = useCallback((f: Battlefield | null) => {
    field.current = f;
  }, []);

  return (
    <div className="combat">
      {stageHost && <StageView key={seed} initialState={state} fit={fit} host={stageHost} onReady={onReady} />}
      <Portraits state={state} choosing={ultimateFor !== null} onUltimate={(m) => !busy && setUltimateFor(m)} />
      <DomainCounters state={state} />
      <div className="relics plaque" aria-label="Relics">
        <span>Relics</span>
        <span className="muted">none yet</span>
      </div>
      <PartyBar state={state} vitals={shown} previews={previews} />
      {state.enemies.map((enemy, slot) => (
        <EnemyPlate key={enemy.id} slot={slot} state={state} vitals={shown} id={enemy.id} aimed={readied?.target === enemy.id} previews={previews} />
      ))}
      <div className="mana" aria-label="Mana">
        <strong>{state.mana}</strong>
        <span>/{state.maxMana}</span>
        <small>Mana</small>
        {state.manaDebt > 0 && <em className="mana-debt">−{state.manaDebt} next turn</em>}
      </div>
      <div className="piles">
        <Pile label="Draw" count={state.piles.draw.length} />
        <Pile label="Discard" count={state.piles.discard.length} />
        <Pile label="Graveyard" count={state.piles.graveyard.length} />
      </div>
      <div className="turn plaque">Turn {state.turn}</div>
      <button className="end-turn" onClick={endTurn} disabled={state.phase !== 'player' || busy}>
        {busy ? 'Enemy turn' : <>End Turn <kbd>E</kbd></>}
      </button>
      {handOpen && <Hand state={state} registry={registry} onPlay={onPlay} onAim={setAim} />}
      {ultimateFor && state.phase === 'player' && (
        <UltimatePanel state={state} member={ultimateFor} onFire={fireUltimate} onClose={closeUltimate} />
      )}
      {banner && (
        <div key={banner.id} className="ultimate-banner" role="status">
          {banner.text}
        </div>
      )}
      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.text}
        </div>
      )}
      {state.phase === 'ended' && !shown && (
        <div className="result">
          <h2>{state.outcome === 'victory' ? 'Victory' : 'Defeat'}</h2>
          <button className="end-turn" onClick={restart}>
            Fight again
          </button>
        </div>
      )}
    </div>
  );
}

const vitalsOf = (state: CombatState): Vitals => ({
  party: { hp: state.party.hp, shield: state.party.shield },
  enemies: state.enemies.map((e) => ({ id: e.id, hp: e.hp, shield: e.shield })),
});
