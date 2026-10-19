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
import { hasIcon, Icon } from './icons.tsx';

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
            className={`portrait domain-${def?.domain ?? ''}${ready ? ' ready' : ''}${m.transcended ? ' transcended' : ''}`}
            onClick={() => ready && onUltimate(m.id)}
            aria-label={`${def?.name}: ultimate ${m.gauge} of ${GAUGE_MAX}${ready ? ', ready' : ''}${m.transcended ? ', Transcended' : ''}`}
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
                  <b>
                    Ultimate: {def.ultimate.name}
                    {m.transcended ? ' (Transcended)' : ''}.
                  </b>{' '}
                  {kit.ultimate}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One badge per Domain present: its icon and number, with count × damage per hit beneath when it
 * has one (Tentacles). Hover or focus shows the name, the numbers in words and the rule.
 */
export function DomainCounters({ state }: { state: CombatState }) {
  const counters = domainCounters(state, registry);
  if (counters.length === 0) return null;
  return (
    <div className="domain-counters">
      {counters.map((c) => {
        const summary =
          c.total === undefined ? `${c.label}: ${c.count}` : `${c.label}: ${c.count}, each hitting for ${c.each}: ${c.total} damage per volley`;
        return (
          <div key={c.domain} className={`counter plaque domain-${c.domain}`} tabIndex={0} aria-label={`${summary}. ${c.help ?? ''}`}>
            {hasIcon(c.icon) ? <Icon name={c.icon} /> : <span className="counter-label">{c.label}</span>}
            <span className="counter-value">
              <strong>{c.total ?? c.count}</strong>
              {c.total !== undefined && (
                <small>
                  {c.count} × {c.each}
                </small>
              )}
            </span>
            <Tip title={c.label}>
              {c.total !== undefined ? (
                <p>
                  <b>{c.count}</b> × <b>{c.each}</b> damage per hit = <b>{c.total}</b> damage per volley.
                </p>
              ) : (
                <p>
                  You have <b>{c.count}</b>.
                </p>
              )}
              {c.help && <p>{c.help}</p>}
            </Tip>
          </div>
        );
      })}
    </div>
  );
}

/** A hover and focus tooltip below its parent. */
function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tip plaque" role="tooltip">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

/** Shield as an icon and a number, with an optional pending gain. */
function ShieldBadge({ amount, gain = 0 }: { amount: number; gain?: number }) {
  return (
    <span className="shield-badge" aria-label={`Shield ${amount}${gain > 0 ? `, +${gain} from this card` : ''}`}>
      <Icon name="shield" />
      {amount}
      {gain > 0 && <em> +{gain}</em>}
    </span>
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
      <h3>
        {def.ultimate.name}
        {m?.transcended && <small className="transcended-tag"> Transcended</small>}
      </h3>
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
          <ShieldBadge amount={shield} gain={shieldGain} />
        )}
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
        {loss > 0 && <div className="bar-ghost" style={{ left: `${(after / maxHp) * 100}%`, width: `${((hp - after) / maxHp) * 100}%` }} />}
      </div>
      {state.party.statuses.length > 0 && (
        <div className="plate-tags">
          <StatusBadges statuses={state.party.statuses} />
        </div>
      )}
      {incoming > 0 && (
        <div className={`incoming${after <= 0 ? ' lethal' : loss === 0 ? ' safe' : ''}`}>
          {after <= 0 ? '☠ Lethal' : loss === 0 ? 'Safe' : `Incoming −${loss}`}
        </div>
      )}
    </div>
  );
}

interface PlateProps {
  id: EntityId;
  state: CombatState;
  vitals: Vitals | null;
  aimed: boolean;
  previews: Preview[];
}

export function EnemyPlate({ id, state, vitals, aimed, previews }: PlateProps) {
  const live = state.enemies.find((e) => e.id === id);
  const home = live ? enemyHome(live.slot, state.enemySlots) : undefined;
  if (!live || !home) return null;
  const enemy = { ...live, ...vitals?.enemies.find((e) => e.id === id) };
  // Four across leaves less room: narrower plates.
  const compact = state.enemySlots >= 4;
  const width = compact ? 184 : 240;
  const def = registry.enemies[enemy.enemy];
  const loss = hpLoss(previews, id);
  const after = Math.max(0, enemy.hp - loss);
  const intent = enemy.hp > 0 ? intentOf(enemy, registry) : undefined;
  return (
    <div
      className={`enemy-plate plaque${aimed ? ' aimed' : ''}${enemy.hp <= 0 ? ' defeated' : ''}${compact ? ' compact' : ''}`}
      style={{ left: home.x - width / 2, top: home.y + 22, width }}
    >
      {intent && <Intent name={intent.name} previews={previewIntent(state, id, registry)} skips={skipping(enemy.statuses)} />}
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
        {enemy.shield > 0 && <ShieldBadge amount={enemy.shield} />}
        <StatusBadges statuses={enemy.statuses} />
      </div>
    </div>
  );
}

/** Icon badges for a bearer's statuses, each with its rule in a tooltip. */
function StatusBadges({ statuses }: { statuses: readonly { status: string; stacks: number }[] }) {
  return (
    <>
      {statuses.map((s) => {
        const def = registry.statuses[s.status];
        const name = statusName(s.status);
        // Control statuses are one-shot: no count.
        const count = def?.skipsAction || def?.endsAfterAction ? '' : ` ${s.stacks}`;
        return (
          <span key={s.status} className={`status-badge ${s.status.replace(/\./g, '-')}`} tabIndex={0} aria-label={`${name}${count}. ${def?.help ?? ''}`}>
            {hasIcon(def?.icon) ? <Icon name={def.icon} /> : name}
            {count}
            <Tip title={`${name}${count}`}>{def?.help && <p>{def.help}</p>}</Tip>
          </span>
        );
      })}
    </>
  );
}

/** The control status that will make this enemy skip its action, if any. */
const skipping = (statuses: readonly { status: string }[]) => {
  const control = statuses.find((s) => registry.statuses[s.status]?.skipsAction);
  return control ? statusName(control.status) : undefined;
};

/** An enemy's shown intent: its name, then an icon and exact number for each thing it will do, or that it will skip. */
function Intent({ name, previews, skips }: { name: string; previews: Preview[]; skips?: string | undefined }) {
  if (skips) {
    return (
      <div className="intent skipped" aria-label={`Intent: ${name}, skipped (${skips})`}>
        <b>{name}</b> <span className="intent-part">skips ({skips})</span>
      </div>
    );
  }
  // Shield for every enemy shows once, marked "all".
  const shields = previews.filter((p) => p.op === 'gainShield');
  const parts = previews.flatMap((p): { icon?: string | undefined; amount?: number | undefined; words: string; all?: boolean }[] => {
    if (p.op === 'damage') return [{ icon: 'attack', amount: p.amount, words: `${p.amount} damage` }];
    if (p.op === 'gainShield') {
      if (p !== shields[0]) return [];
      return shields.length > 1
        ? [{ icon: 'shield', amount: p.amount, words: `${p.amount} Shield to every enemy`, all: true }]
        : [{ icon: 'shield', amount: p.amount, words: `${p.amount} Shield` }];
    }
    if (p.op === 'heal') return [{ icon: 'heal', amount: p.amount, words: `heals an ally ${p.amount}` }];
    if (p.op === 'summon') return [{ icon: 'summon', amount: p.amount, words: `summons ${p.amount}` }];
    if (p.op === 'applyStatus') {
      const icon = registry.statuses[p.status ?? '']?.icon;
      return [{ icon, amount: p.amount, words: `${p.amount} ${statusName(p.status ?? '')}` }];
    }
    return [];
  });
  const attacks = previews.some((p) => p.op === 'damage');
  return (
    <div className={`intent${attacks ? ' attack' : ''}`} aria-label={`Intent: ${name}, ${parts.map((p) => p.words).join(', ')}`}>
      <b>{name}</b>
      {parts.map((p, i) => (
        <span key={i} className={`intent-part ${p.icon ?? ''}`}>
          {hasIcon(p.icon) ? <Icon name={p.icon} /> : p.words}
          {hasIcon(p.icon) && p.amount}
          {p.all && <small> all</small>}
        </span>
      ))}
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

/** The run's relics along the top, in acquisition order, each with its rule on hover or focus. */
export function RelicBar({ state }: { state: CombatState }) {
  return (
    <div className="relics plaque" aria-label="Relics">
      <span>Relics</span>
      {state.relics.length === 0 && <span className="muted">none yet</span>}
      {state.relics.map((r) => {
        const def = registry.relics[r.relic];
        return (
          <span key={r.id} className={`relic tier-${def?.tier ?? 'common'}`} tabIndex={0} aria-label={`${def?.name}, ${def?.tier}: ${def?.text}`}>
            {def?.name ?? r.relic}
            <Tip title={def?.name ?? r.relic}>
              <p className="tier-line">{def?.tier}</p>
              <p>{def?.text}</p>
            </Tip>
          </span>
        );
      })}
    </div>
  );
}
