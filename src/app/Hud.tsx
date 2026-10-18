import { useEffect } from 'react';
import { registry } from '../content/registry.ts';
import {
  describeKit,
  domainCounters,
  GAUGE_MAX,
  intentOf,
  previewIntent,
  previewUltimate,
  type CombatState,
  type EntityId,
  type Preview,
  type Vitals,
} from '../engine/index.ts';
import { portraitArt } from '../stage/art.ts';
import { enemyHome } from '../stage/layout.ts';

// The combat HUD (docs/DESIGN.md, "Combat screen"). Every number shown comes from engine state
// or engine previews; nothing here calculates a rule.

const statusName = (id: string) => id.replace(/^status\./, '').replace(/^./, (c) => c.toUpperCase());

/** Damage a list of previews would deal to one target, after Shield. */
const hpLoss = (previews: Preview[], target: EntityId) =>
  previews
    .filter((p) => (p.op === 'damage' || p.op === 'volley' || p.op === 'loseHp') && p.target === target)
    .reduce((n, p) => n + (p.amount ?? 0) - (p.absorbed ?? 0), 0);

export function Portraits({ state, choosing, onUltimate }: { state: CombatState; choosing: boolean; onUltimate: (member: EntityId) => void }) {
  return (
    <div className={`portraits plaque${choosing ? ' choosing' : ''}`}>
      {state.members.map((m, slot) => {
        const def = registry.characters[m.character];
        const art = portraitArt[m.character];
        const ready = m.gauge >= GAUGE_MAX && state.phase === 'player';
        const kit = describeKit(state, m.id, registry);
        return (
          <button
            key={m.id}
            className={`portrait domain-${def?.domain ?? ''}${ready ? ' ready' : ''}`}
            onClick={() => ready && onUltimate(m.id)}
            aria-label={`${def?.name}: ultimate ${m.gauge} of ${GAUGE_MAX}${ready ? ', ready' : ''}`}
          >
            <div className="portrait-ring" style={{ '--gauge': `${(m.gauge / GAUGE_MAX) * 360}deg` } as React.CSSProperties}>
              <div className="portrait-face">{art ? <img src={art} alt="" /> : <span>{def?.name.charAt(0)}</span>}</div>
            </div>
            <span className="portrait-name">{def?.name}</span>
            <span className="portrait-gauge">{ready ? <>Ready <kbd>⇧{slot + 1}</kbd></> : `${m.gauge}`}</span>
            <div className="kit-card plaque" role="tooltip">
              {def?.passive?.name && (
                <p>
                  <b>{def.passive.name}</b> <i>({def.passive.scope})</i> {kit.passive}
                </p>
              )}
              {def?.ultimate && (
                <p>
                  <b>Ultimate: {def.ultimate.name}.</b> {kit.ultimate}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** One badge per Domain present. Rapture's reads as total damage, with Tentacles × damage per hit beneath. */
export function DomainCounters({ state }: { state: CombatState }) {
  const counters = domainCounters(state, registry);
  if (counters.length === 0) return null;
  return (
    <div className="domain-counters">
      {counters.map((c) => (
        <div
          key={c.domain}
          className={`counter plaque domain-${c.domain}`}
          aria-label={c.total === undefined ? `${c.count} ${c.label}` : `${c.label}: ${c.count} × ${c.each} = ${c.total} damage`}
        >
          <strong>{c.total ?? c.count}</strong>
          <span className="counter-label">
            {c.label}
            {c.total !== undefined && (
              <small>
                {c.count} × {c.each}
              </small>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function UltimatePanel({ state, member, onFire, onClose }: { state: CombatState; member: EntityId; onFire: () => void; onClose: () => void }) {
  const m = state.members.find((x) => x.id === member);
  const def = m ? registry.characters[m.character] : undefined;
  const preview = previewUltimate(state, member, registry);
  // Captures Enter and Escape ahead of the hand, which is waiting underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (e.key === 'Enter' && preview) onFire();
      else onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [preview, onFire, onClose]);
  if (!def?.ultimate) return null;
  return (
    <div className="ultimate-panel plaque" role="dialog" aria-label={`${def.name}'s ultimate`}>
      <h3>{def.ultimate.name}</h3>
      <p>{describeKit(state, member, registry).ultimate}</p>
      <div className="panel-buttons">
        <button className="end-turn" onClick={onFire} disabled={!preview}>
          Fire <kbd>Enter</kbd>
        </button>
        <button className="ghost" onClick={onClose}>
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}

/** `vitals`: HP and Shield as the battlefield currently shows them, while a sequence plays out. */
export function PartyBar({ state, vitals, previews }: { state: CombatState; vitals: Vitals | null; previews: Preview[] }) {
  const { maxHp } = state.party;
  const { hp, shield } = vitals?.party ?? state.party;
  const shieldGain = previews.filter((p) => p.op === 'gainShield' && p.target === 'party').reduce((n, p) => n + (p.amount ?? 0), 0);
  // Everything the enemies' shown intents will do to the party, with the Shield it has now.
  const intents = state.phase === 'player' && !vitals ? state.enemies.flatMap((e) => previewIntent(state, e.id, registry)) : [];
  const incoming = intents.filter((p) => p.op === 'damage' && p.target === 'party').reduce((n, p) => n + (p.amount ?? 0), 0);
  const loss = hpLoss(intents, 'party');
  const after = Math.max(0, hp - loss);
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
        {loss > 0 && <div className="bar-ghost" style={{ left: `${(after / maxHp) * 100}%`, width: `${((hp - after) / maxHp) * 100}%` }} />}
      </div>
      {incoming > 0 && (
        <div className={`incoming${after <= 0 ? ' lethal' : loss === 0 ? ' safe' : ''}`}>
          {after <= 0 ? '☠ Lethal' : loss === 0 ? 'Safe' : `Incoming −${loss}`}
        </div>
      )}
    </div>
  );
}

interface PlateProps {
  slot: number;
  id: EntityId;
  state: CombatState;
  vitals: Vitals | null;
  aimed: boolean;
  previews: Preview[];
}

export function EnemyPlate({ slot, id, state, vitals, aimed, previews }: PlateProps) {
  const live = state.enemies.find((e) => e.id === id);
  const home = enemyHome(slot, state.enemies.length);
  if (!live || !home) return null;
  const enemy = { ...live, ...vitals?.enemies.find((e) => e.id === id) };
  const def = registry.enemies[enemy.enemy];
  const loss = hpLoss(previews, id);
  const after = Math.max(0, enemy.hp - loss);
  const intent = enemy.hp > 0 ? intentOf(enemy, registry) : undefined;
  return (
    <div
      className={`enemy-plate plaque${aimed ? ' aimed' : ''}${enemy.hp <= 0 ? ' defeated' : ''}`}
      style={{ left: home.x - 120, top: home.y + 22 }}
    >
      {intent && <Intent name={intent.name} previews={previewIntent(state, id, registry)} />}
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
      <div className="plate-tags">
        {enemy.shield > 0 && <span className="shield-badge">Shield {enemy.shield}</span>}
        {enemy.statuses.map((s) => (
          <span key={s.status} className={`status-badge ${s.status.replace(/\./g, '-')}`}>
            {statusName(s.status)} {s.stacks}
          </span>
        ))}
      </div>
    </div>
  );
}

/** An enemy's shown intent with its exact numbers. */
function Intent({ name, previews }: { name: string; previews: Preview[] }) {
  const parts = previews.flatMap((p) => {
    if (p.op === 'damage') return [`${p.amount} damage`];
    if (p.op === 'gainShield') return [`${p.amount} Shield`];
    if (p.op === 'applyStatus') return [`${p.amount} ${statusName(p.status ?? '')}`];
    return [];
  });
  const attacks = previews.some((p) => p.op === 'damage');
  return (
    <div className={`intent${attacks ? ' attack' : ''}`} aria-label={`Intent: ${name}, ${parts.join(', ')}`}>
      <b>{name}</b> {parts.join(' · ')}
    </div>
  );
}

export function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="pile plaque">
      <strong>{count}</strong>
      <small>{label}</small>
    </div>
  );
}
