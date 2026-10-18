import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registry } from '../content/registry.ts';
import {
  apply,
  previewCard,
  startCombat,
  type CombatState,
  type Command,
  type EntityId,
  type Preview,
} from '../engine/index.ts';
import { portraitArt } from '../stage/art.ts';
import type { Battlefield } from '../stage/Battlefield.ts';
import { ENEMY_HOMES } from '../stage/layout.ts';
import { StageView } from '../stage/StageView.tsx';
import { useFrame } from './Frame.tsx';
import { Hand, type Aim } from './Hand.tsx';

// Slice line-up: the starter four with their picked Bloomdrawn sprites, Agathe in front.
const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
const DEFAULT_ENEMIES = ['enemy.training-dummy', 'enemy.training-dummy', 'enemy.training-dummy'];

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

  const run = useCallback((command: Command) => {
    const result = apply(current.current, command, registry);
    if (!result.ok) {
      setToast({ text: result.reason, id: Date.now() });
      return false;
    }
    current.current = result.state;
    setState(result.state);
    field.current?.play(result.events);
    return true;
  }, []);

  const onPlay = useCallback(
    (card: EntityId, target?: EntityId) => run(target ? { type: 'playCard', card, target } : { type: 'playCard', card }),
    [run],
  );
  const endTurn = useCallback(() => run({ type: 'endTurn' }), [run]);
  const restart = () => {
    const next = seed + 1;
    const fresh = newCombat(next);
    current.current = fresh;
    setSeed(next);
    setState(fresh);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') endTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [endTurn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Dev and e2e only: lets the settle check read actor positions.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __bloomdrawn?: unknown }).__bloomdrawn = { actors: () => field.current?.snapshot() ?? [] };
  }, []);

  const previews = useMemo(() => {
    if (!aim) return [];
    const command = aim.target ? { type: 'playCard' as const, card: aim.card, target: aim.target } : { type: 'playCard' as const, card: aim.card };
    return previewCard(state, command, registry) ?? [];
  }, [aim, state]);

  const onReady = useCallback((f: Battlefield | null) => {
    field.current = f;
  }, []);

  return (
    <div className="combat">
      {stageHost && <StageView key={seed} initialState={state} fit={fit} host={stageHost} onReady={onReady} />}
      <Portraits state={state} />
      <div className="relics plaque" aria-label="Relics">
        <span>Relics</span>
        <span className="muted">none yet</span>
      </div>
      <PartyBar state={state} previews={previews} />
      {state.enemies.map((enemy, slot) => (
        <EnemyPlate key={enemy.id} slot={slot} state={state} id={enemy.id} aimed={aim?.target === enemy.id} previews={previews} />
      ))}
      <div className="mana" aria-label="Mana">
        <strong>{state.mana}</strong>
        <span>/{state.maxMana}</span>
        <small>Mana</small>
      </div>
      <div className="piles">
        <Pile label="Draw" count={state.piles.draw.length} />
        <Pile label="Discard" count={state.piles.discard.length} />
        <Pile label="Graveyard" count={state.piles.graveyard.length} />
      </div>
      <div className="turn plaque">Turn {state.turn}</div>
      <button className="end-turn" onClick={endTurn} disabled={state.phase !== 'player'}>
        End Turn <kbd>E</kbd>
      </button>
      {state.phase !== 'ended' && <Hand state={state} registry={registry} onPlay={onPlay} onAim={setAim} />}
      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.text}
        </div>
      )}
      {state.phase === 'ended' && (
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

function Portraits({ state }: { state: CombatState }) {
  return (
    <div className="portraits plaque">
      {state.members.map((m) => {
        const def = registry.characters[m.character];
        const art = portraitArt[m.character];
        return (
          <div key={m.id} className={`portrait domain-${def?.domain ?? ''}`}>
            <div className="portrait-ring">{art ? <img src={art} alt="" /> : <span>{def?.name.charAt(0)}</span>}</div>
            <span>{def?.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function PartyBar({ state, previews }: { state: CombatState; previews: Preview[] }) {
  const { hp, maxHp, shield } = state.party;
  const shieldGain = previews.filter((p) => p.op === 'gainShield').reduce((n, p) => n + (p.amount ?? 0), 0);
  return (
    <div className="party-bar plaque">
      <div className="bar-label">
        <span>Party</span>
        <strong>
          {hp} / {maxHp}
        </strong>
        {(shield > 0 || shieldGain > 0) && (
          <span className="shield-badge">
            Shield {shield}
            {shieldGain > 0 && <em> +{shieldGain}</em>}
          </span>
        )}
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
      </div>
    </div>
  );
}

interface PlateProps {
  slot: number;
  id: EntityId;
  state: CombatState;
  aimed: boolean;
  previews: Preview[];
}

function EnemyPlate({ slot, id, state, aimed, previews }: PlateProps) {
  const enemy = state.enemies.find((e) => e.id === id);
  const home = ENEMY_HOMES[slot];
  if (!enemy || !home) return null;
  const def = registry.enemies[enemy.enemy];
  const incoming = previews.filter((p) => p.op === 'damage' && p.target === id);
  const loss = incoming.reduce((n, p) => n + (p.amount ?? 0) - (p.absorbed ?? 0), 0);
  const after = Math.max(0, enemy.hp - loss);
  return (
    <div
      className={`enemy-plate plaque${aimed ? ' aimed' : ''}${enemy.hp <= 0 ? ' defeated' : ''}`}
      style={{ left: home.x - 110, top: home.y + 22 }}
    >
      <div className="bar-label">
        <span>{def?.name}</span>
        <strong>
          {enemy.hp} / {enemy.maxHp}
        </strong>
      </div>
      <div className="bar small">
        <div className="bar-fill" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
        {loss > 0 && <div className="bar-ghost" style={{ left: `${(after / enemy.maxHp) * 100}%`, width: `${((enemy.hp - after) / enemy.maxHp) * 100}%` }} />}
      </div>
      {loss > 0 && <div className="plate-preview">−{loss}</div>}
      {enemy.shield > 0 && <span className="shield-badge">Shield {enemy.shield}</span>}
    </div>
  );
}

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="pile plaque">
      <strong>{count}</strong>
      <small>{label}</small>
    </div>
  );
}
