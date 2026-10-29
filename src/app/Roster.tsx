import { useEffect, useState } from 'react';
import { registry } from '../content/registry.ts';
import { describeCharacter, withDupes, type CardDef } from '../engine/index.ts';
import { runCardText } from '../game/expedition.ts';
import { PARTY_SIZE, partyProblem, placeInTeam, quickTeam, removeFromTeam, renameTeam, TEAM_NAME_LENGTH, type Team } from '../game/profile.ts';
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

/** A character as a tile: her art, name and Domain, her dupe level if any, and her place in the party if she has one. */
function Tile({ id, place, level, onClick }: { id: string; place?: number | undefined; level?: number | undefined; onClick: () => void }) {
  const def = registry.characters[id];
  return (
    <button className={`roster-tile domain-${def?.domain ?? ''}${place !== undefined ? ' chosen' : ''}`} aria-label={def?.name ?? id} aria-pressed={place !== undefined} onClick={onClick}>
      <Art id={id} className="roster-art" />
      <strong>{def?.name ?? id}</strong>
      <span>{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
      {place !== undefined && <em className="roster-place">{place + 1}</em>}
      {level ? <em className="roster-level">C{level}</em> : null}
    </button>
  );
}

const placeLabel = (i: number) => (i === 0 ? 'Front' : String(i + 1));

interface PartySelectProps {
  owned: readonly string[];
  teams: readonly Team[];
  /** The preset to open on. */
  team: number;
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
export function PartySelect({ owned, teams: initialTeams, team: initialTeam, onChange, onStart, onBack }: PartySelectProps) {
  const [teams, setTeams] = useState<Team[]>(() => initialTeams.map((t) => ({ ...t, members: [...t.members] })));
  const [team, setTeam] = useState(Math.min(initialTeam, initialTeams.length - 1));
  const [picking, setPicking] = useState<Picking>(null);
  const current = teams[team]!;
  const problem = partyProblem(current.members, owned);

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
              <button className={`team-preset${i === team ? ' selected' : ''}`} aria-pressed={i === team} onClick={() => commit(teams, i)}>
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

/** Every owned character, with her dupe level; one opens her page. */
export function Roster({ owned, dupes = {}, onBack }: { owned: readonly string[]; dupes?: Readonly<Record<string, number>> | undefined; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <CharacterPage id={open} level={dupes[open] ?? 0} onBack={() => setOpen(null)} />;
  return (
    <div className="roster-screen">
      <h2 className="panel-title">Roster</h2>
      <div className="roster-grid">
        {owned.map((id) => (
          <Tile key={id} id={id} level={dupes[id]} onClick={() => setOpen(id)} />
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

/** A character's stats and kit at her dupe level, with the numbers her stats fix, and what each dupe level does. */
function CharacterPage({ id, level, onBack }: { id: string; level: number; onBack: () => void }) {
  const base = registry.characters[id];
  if (!base) return null;
  const def = withDupes(base, level);
  const kit = describeCharacter(def);
  const cards = def.cards.map((c) => registry.cards[c]).filter((c): c is CardDef => c !== undefined);
  const rewards = Object.values(registry.cards).filter((c) => c.reward && c.owner === id);
  const face = (card: CardDef) => (
    <CardFace
      key={card.id}
      id={card.id}
      def={card}
      owner={def}
      text={runCardText({ card: card.id, owner: id }, registry, { charge: false, keywords: false, mark: markNumber }, { [id]: level })}
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
