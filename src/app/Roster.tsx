import { useEffect, useRef, useState } from 'react';
import { itemCount } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { describeCharacter, type CardDef } from '../engine/index.ts';
import { fieldedCharacter, runCardText, type Growth } from '../game/expedition.ts';
import { affordableLevels, ascend, ascensionCost, ASCENSIONS, ascensionsOf, levelCap, levelCost, levelOf, MAX_LEVEL, MEMORIES, type GrowthResult } from '../game/levels.ts';
import { PARTY_SIZE, partyProblem, plural, type Profile, placeInTeam, quickTeam, removeFromTeam, renameTeam, TEAM_NAME_LENGTH, type Team } from '../game/profile.ts';
import { battleArt } from '../stage/art.ts';
import { CardFace, markNumber } from './CardView.tsx';

// The roster, a character's page and party select (docs/notes/m5-collection.md, "The roster and the party").

const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

const fullName = (id: string) => {
  const def = registry.characters[id];
  return def?.title ? `${def.name}, ${def.title}` : (def?.name ?? id);
};

/**
 * A character's battle art at a fixed height, the same for everyone as on the battlefield, so a wide
 * figure (Anthe) stands as tall as the rest. Art wider than its window is cut at the sides, never shrunk.
 */
export function Art({ id, className }: { id: string; className: string }) {
  const art = battleArt[id];
  return (
    <div className={`char-art ${className}`}>
      {art ? <img src={art} alt="" draggable={false} /> : <span className="monogram">{registry.characters[id]?.name.charAt(0)}</span>}
    </div>
  );
}

/** A character as a tile: her art, name and Domain, her level and dupe level if given, and her place in the party if she has one. */
function Tile({ id, place, level, dupes, onClick }: { id: string; place?: number | undefined; level?: number | undefined; dupes?: number | undefined; onClick: () => void }) {
  const def = registry.characters[id];
  return (
    <button className={`roster-tile domain-${def?.domain ?? ''}${place !== undefined ? ' chosen' : ''}`} aria-label={def?.name ?? id} aria-pressed={place !== undefined} onClick={onClick}>
      <Art id={id} className="roster-art" />
      <strong>{def?.name ?? id}</strong>
      <span>{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
      {place !== undefined && <em className="roster-place">{place + 1}</em>}
      {level ? <em className="roster-lv">Lv {level}</em> : null}
      {dupes ? <em className="roster-level">C{dupes}</em> : null}
    </button>
  );
}

const placeLabel = (i: number) => (i === 0 ? 'Front' : String(i + 1));

interface PartySelectProps {
  owned: readonly string[];
  teams: readonly Team[];
  /** The preset to open on. */
  team: number;
  /** Ducats banked, and what one more preset costs in them. */
  money: number;
  presetCost: number;
  /** Buys one more preset. */
  onBuy: () => Promise<void>;
  /** Called with every change, to save the presets. */
  onChange: (teams: Team[], team: number) => void;
  onStart: (party: string[]) => void;
  onBack: () => void;
}

/** Which picker is open: one place's, or quick select with the characters clicked so far. */
type Picking = { kind: 'place'; place: number } | { kind: 'quick'; picked: string[] } | null;

/**
 * Party select (owner, 26 Oct): team presets on the left; the chosen one's four places on the right.
 * A place opens the character list: a character goes in, or swaps with the place she was in. Quick
 * select fills all four in the order clicked.
 */
export function PartySelect({ owned, teams: initialTeams, team: initialTeam, money, presetCost, onBuy, onChange, onStart, onBack }: PartySelectProps) {
  const [teams, setTeams] = useState<Team[]>(() => initialTeams.map((t) => ({ ...t, members: [...t.members] })));
  const [team, setTeam] = useState(Math.min(initialTeam, initialTeams.length - 1));
  const [picking, setPicking] = useState<Picking>(null);
  const current = teams[team]!;
  const problem = partyProblem(current.members, owned);
  // The preset it opens on is in view, a bought one at the foot of the list included.
  const chosen = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    chosen.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const commit = (next: Team[], chosen = team) => {
    setTeams(next);
    setTeam(chosen);
    onChange(next, chosen);
  };
  const setMembers = (members: (string | null)[]) => commit(teams.map((t, i) => (i === team ? { ...t, members } : t)));
  const setName = (name: string, done: boolean) => {
    const next = teams.map((t, i) => (i === team ? { ...t, name: done ? renameTeam(name, i) : name.slice(0, TEAM_NAME_LENGTH) } : t));
    if (done) commit(next);
    else setTeams(next);
  };

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  return (
    <div className="team-screen">
      <aside className="team-list-pane">
        <h2 className="panel-title">Choose your party</h2>
        <ul className="team-list" aria-label="Teams">
          {teams.map((t, i) => (
            <li key={i}>
              <button ref={i === team ? chosen : undefined} className={`team-preset${i === team ? ' selected' : ''}`} aria-pressed={i === team} onClick={() => commit(teams, i)}>
                <strong>{t.name}</strong>
                <span className="team-preset-faces">
                  {t.members.map((m, j) =>
                    m ? <Art key={j} id={m} className={`team-preset-face domain-${registry.characters[m]?.domain ?? ''}`} /> : <span key={j} className="team-preset-face" />,
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="ghost team-buy" disabled={money < presetCost} onClick={() => void onBuy()}>
          New preset: {itemCount('money', presetCost)}
        </button>
        <p className="team-money">You have {itemCount('money', money)}</p>
      </aside>
      <section className="team-pane">
        <input
          className="team-name"
          aria-label="Team name"
          value={current.name}
          maxLength={TEAM_NAME_LENGTH}
          onChange={(e) => setName(e.target.value, false)}
          onBlur={(e) => setName(e.target.value, true)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <ol className="team-slots" aria-label="Party">
          {current.members.map((id, i) => {
            const def = id ? registry.characters[id] : undefined;
            return (
              <li key={i}>
                <button
                  className={`team-slot${id ? ` domain-${def?.domain ?? ''}` : ' empty'}`}
                  aria-label={`${placeLabel(i)}: ${def?.name ?? 'empty'}`}
                  onClick={() => setPicking({ kind: 'place', place: i })}
                >
                  <span className="team-slot-place">{placeLabel(i)}</span>
                  {id ? (
                    <>
                      <Art id={id} className="team-slot-art" />
                      <strong>{def?.name ?? id}</strong>
                      <span className="team-slot-domain">{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
                    </>
                  ) : (
                    <span className="team-slot-plus" aria-hidden>
                      +
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="roster-hint" role="status">
          {problem ?? 'Ready.'}
        </p>
        <div className="panel-buttons">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <button className="ghost" onClick={() => setPicking({ kind: 'quick', picked: [] })}>
            Quick select
          </button>
          <button className="end-turn" disabled={problem !== undefined} onClick={() => onStart(current.members as string[])}>
            Start run
          </button>
        </div>
      </section>
      {picking && (
        <div className="team-picker" role="dialog" aria-label={picking.kind === 'quick' ? 'Quick select' : `Choose for ${placeLabel(picking.place)}`}>
          <h3>{picking.kind === 'quick' ? 'Quick select: click up to four, front first' : `Choose for ${placeLabel(picking.place)}`}</h3>
          <div className="team-picker-grid">
            {owned.map((id) => {
              const place = picking.kind === 'quick' ? picking.picked.indexOf(id) : current.members.indexOf(id);
              return (
                <Tile
                  key={id}
                  id={id}
                  place={place >= 0 ? place : undefined}
                  onClick={() => {
                    if (picking.kind === 'place') {
                      setMembers(placeInTeam(current.members, picking.place, id));
                      setPicking(null);
                    } else {
                      const picked = picking.picked.includes(id) ? picking.picked.filter((x) => x !== id) : picking.picked.length < PARTY_SIZE ? [...picking.picked, id] : picking.picked;
                      setPicking({ kind: 'quick', picked });
                    }
                  }}
                />
              );
            })}
          </div>
          <div className="panel-buttons">
            <button className="ghost" onClick={() => setPicking(null)}>
              Cancel
            </button>
            {picking.kind === 'place' && current.members[picking.place] && (
              <button
                className="ghost"
                onClick={() => {
                  setMembers(removeFromTeam(current.members, picking.place));
                  setPicking(null);
                }}
              >
                Remove
              </button>
            )}
            {picking.kind === 'quick' && (
              <button
                className="end-turn"
                onClick={() => {
                  setMembers(quickTeam(picking.picked));
                  setPicking(null);
                }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RosterProps {
  owned: readonly string[];
  profile: Profile;
  /** Dupe levels and levels as shown and fielded: the profile's, or a dev build's. */
  growth: Growth;
  onLevelUp: (id: string, levels: number) => Promise<GrowthResult>;
  onAscend: (id: string) => Promise<GrowthResult>;
  onBack: () => void;
}

/** Every owned character, with her level and dupe level; one opens her page. */
export function Roster({ owned, profile, growth, onLevelUp, onAscend, onBack }: RosterProps) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <CharacterPage id={open} profile={profile} growth={growth} onLevelUp={onLevelUp} onAscend={onAscend} onBack={() => setOpen(null)} />;
  return (
    <div className="roster-screen">
      <h2 className="panel-title">Roster</h2>
      <div className="roster-grid">
        {owned.map((id) => (
          <Tile key={id} id={id} level={growth.levels?.[id] ?? 1} dupes={growth.dupes?.[id]} onClick={() => setOpen(id)} />
        ))}
      </div>
      <div className="panel-buttons">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

const itemsText = (items: Readonly<Record<string, number>>) =>
  Object.entries(items)
    .map(([id, n]) => itemCount(id, n))
    .join(', ');

/** "Spent: 3 Clear Memories, 120 Ducats. Back: 2 Faint Memories." */
function changeText(change: Readonly<Record<string, number>>): string {
  const side = (sign: number) => Object.fromEntries(Object.entries(change).filter(([, n]) => n * sign > 0).map(([id, n]) => [id, n * sign]));
  const back = side(1);
  return `Spent: ${itemsText(side(-1))}.${Object.keys(back).length > 0 ? ` Back: ${itemsText(back)}.` : ''}`;
}

/**
 * Levelling on her page: her level and ascensions, the Memories and Ducats banked, and buttons to
 * level once, as far as can be paid for, or ascend at a level cap. The game prices each and refuses
 * what can't be paid; the page only shows it.
 */
function Growing({ id, profile, onLevelUp, onAscend }: { id: string; profile: Profile; onLevelUp: RosterProps['onLevelUp']; onAscend: RosterProps['onAscend'] }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const level = levelOf(profile, id);
  const ascensions = ascensionsOf(profile, id);
  const cap = levelCap(ascensions);
  const most = affordableLevels(profile, id);
  const items = profile.items ?? {};
  const act = (job: () => Promise<GrowthResult>, done: (level: number) => string) => {
    if (busy) return;
    setBusy(true);
    job()
      .then((result) => setNote(result.ok ? `${done(result.level)} ${changeText(result.change)}` : result.reason))
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };
  const priced = (levels: number) => {
    const cost = levelCost(level, levels);
    return `${cost.exp.toLocaleString('en-GB')} EXP, ${itemCount('money', cost.money)}`;
  };
  const ascension = ascensionCost(profile, id, registry);
  return (
    <section className="character-growth" aria-label="Level">
      <h3>
        Level {level} <small>of {cap} · {plural(ascensions, 'ascension')} of {ASCENSIONS.length}</small>
      </h3>
      <p className="character-bank">
        {MEMORIES.map((m) => itemCount(m.item, items[m.item] ?? 0)).join(' · ')} · {itemCount('money', items.money ?? 0)}
      </p>
      <div className="panel-buttons">
        {level >= MAX_LEVEL ? (
          <p>The highest level.</p>
        ) : level < cap ? (
          <>
            <button className="end-turn" disabled={busy || most < 1} onClick={() => act(() => onLevelUp(id, 1), (n) => `Level ${n}.`)}>
              Level up <small>{priced(1)}</small>
            </button>
            {most > 1 && (
              <button className="end-turn" disabled={busy} onClick={() => act(() => onLevelUp(id, most), (n) => `Level ${n}.`)}>
                To level {level + most} <small>{priced(most)}</small>
              </button>
            )}
          </>
        ) : (
          <button className="end-turn" disabled={busy || !ascension || !ascend(profile, id, registry).ok} onClick={() => act(() => onAscend(id), () => 'Ascended.')}>
            Ascend <small>{ascension ? itemsText(ascension) : ''}</small>
          </button>
        )}
      </div>
      <p className="character-note" role="status">
        {note ?? (level < cap && most < 1 && level < MAX_LEVEL ? `The next level needs ${priced(1)}.` : '')}
      </p>
    </section>
  );
}

/** A character's stats and kit at her dupe level and level, with the numbers her stats fix, what each dupe level does, and levelling. */
function CharacterPage({ id, profile, growth, onLevelUp, onAscend, onBack }: Omit<RosterProps, 'owned' | 'onBack'> & { id: string; onBack: () => void }) {
  const base = registry.characters[id];
  const def = fieldedCharacter(id, registry, growth);
  if (!base || !def) return null;
  const level = growth.dupes?.[id] ?? 0;
  const kit = describeCharacter(def);
  const cards = def.cards.map((c) => registry.cards[c]).filter((c): c is CardDef => c !== undefined);
  const rewards = Object.values(registry.cards).filter((c) => c.reward && c.owner === id);
  const face = (card: CardDef) => (
    <CardFace
      key={card.id}
      id={card.id}
      def={card}
      owner={def}
      text={runCardText({ card: card.id, owner: id }, registry, { charge: false, keywords: false, mark: markNumber }, growth)}
      cost={card.cost}
      registry={registry}
      playable
    />
  );
  return (
    <div className={`character-page domain-${def.domain}`} aria-label={def.name}>
      <Art id={id} className="character-art" />
      <div className="character-info">
        <h2>{fullName(id)}</h2>
        <p className="character-domain">
          {DOMAIN_LABEL[def.domain] ?? def.domain}
          {` · Level ${growth.levels?.[id] ?? 1}`}
          {base.dupes?.length ? ` · C${level}` : ''}
        </p>
        <dl className="character-stats">
          <dt>HP</dt>
          <dd>{def.stats.hp}</dd>
          <dt>Attack</dt>
          <dd>{def.stats.attack}</dd>
          <dt>Defense</dt>
          <dd>{def.stats.defense}</dd>
        </dl>
        <Growing id={id} profile={profile} onLevelUp={onLevelUp} onAscend={onAscend} />
        {def.passive && (
          <section>
            <h3>
              {def.passive.name} <small>Passive · {def.passive.scope === 'run' ? 'run' : 'combat'}</small>
            </h3>
            <p>{kit.passive}</p>
          </section>
        )}
        {def.ultimate && (
          <section>
            <h3>
              {def.ultimate.name} <small>Ultimate</small>
            </h3>
            <p>{kit.ultimate}</p>
            {kit.transcended && (
              <p className="character-transcended">
                <em>Transcended:</em> {kit.transcended}
              </p>
            )}
          </section>
        )}
        <h3>Cards</h3>
        <div className="character-cards">{cards.map(face)}</div>
        {rewards.length > 0 && (
          <>
            <h3>Reward cards</h3>
            <div className="character-cards">{rewards.map(face)}</div>
          </>
        )}
        {base.dupes?.length ? (
          <section>
            <h3>Dupes</h3>
            <ol className="character-dupes" aria-label="Dupes">
              {base.dupes.map((d, i) => (
                <li key={i} className={i < level ? 'reached' : undefined}>
                  <em>C{i + 1}</em> {d.text}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
      <div className="panel-buttons character-back">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
