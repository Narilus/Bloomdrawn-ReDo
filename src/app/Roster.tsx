import { useState } from 'react';
import { registry } from '../content/registry.ts';
import { describeCharacter, type CardDef } from '../engine/index.ts';
import { runCardText } from '../game/expedition.ts';
import { PARTY_SIZE, partyProblem } from '../game/profile.ts';
import { battleArt } from '../stage/art.ts';
import { CardFace, markNumber } from './CardView.tsx';

// The roster, a character's page and party select (docs/notes/m5-collection.md, "The roster and the party").

const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

const fullName = (id: string) => {
  const def = registry.characters[id];
  return def?.title ? `${def.name}, ${def.title}` : (def?.name ?? id);
};

/** A character as a tile: her battle art, name and Domain. */
function Tile({ id, chosen, onClick }: { id: string; chosen?: number | undefined; onClick: () => void }) {
  const def = registry.characters[id];
  const art = battleArt[id];
  return (
    <button className={`roster-tile domain-${def?.domain ?? ''}${chosen !== undefined ? ' chosen' : ''}`} aria-label={def?.name ?? id} aria-pressed={chosen !== undefined} onClick={onClick}>
      <div className="roster-art">{art ? <img src={art} alt="" draggable={false} /> : <span className="monogram">{def?.name.charAt(0)}</span>}</div>
      <strong>{def?.name ?? id}</strong>
      <span>{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
      {chosen !== undefined && <em className="roster-place">{chosen + 1}</em>}
    </button>
  );
}

interface PartySelectProps {
  owned: readonly string[];
  initial: readonly string[];
  onStart: (party: string[]) => void;
  onBack: () => void;
}

/** Choose any four owned characters, front first: a click adds to the next place or takes her out; the arrows move her. */
export function PartySelect({ owned, initial, onStart, onBack }: PartySelectProps) {
  const [party, setParty] = useState<string[]>([...initial]);
  const problem = partyProblem(party, owned);
  const toggle = (id: string) =>
    setParty((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PARTY_SIZE ? [...p, id] : p));
  const swap = (i: number, j: number) =>
    setParty((p) => {
      const next = [...p];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <div className="roster-screen">
      <h2 className="panel-title">Choose your party</h2>
      <ol className="party-slots" aria-label="Party">
        {Array.from({ length: PARTY_SIZE }, (_, i) => {
          const id = party[i];
          return (
            <li key={i} className={`party-slot${id ? ` domain-${registry.characters[id]?.domain ?? ''}` : ' empty'}`}>
              <span className="party-slot-place">{i === 0 ? 'Front' : i + 1}</span>
              {id ? (
                <>
                  <strong>{registry.characters[id]?.name ?? id}</strong>
                  <div className="party-slot-moves">
                    <button className="ghost" aria-label={`Move ${registry.characters[id]?.name} forward`} disabled={i === 0} onClick={() => swap(i, i - 1)}>
                      ◀
                    </button>
                    <button className="ghost" aria-label={`Move ${registry.characters[id]?.name} back`} disabled={i >= party.length - 1} onClick={() => swap(i, i + 1)}>
                      ▶
                    </button>
                  </div>
                </>
              ) : (
                <span className="party-slot-empty">Empty</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="roster-grid">
        {owned.map((id) => (
          <Tile key={id} id={id} chosen={party.includes(id) ? party.indexOf(id) : undefined} onClick={() => toggle(id)} />
        ))}
      </div>
      <p className="roster-hint" role="status">
        {problem ?? 'Ready.'}
      </p>
      <div className="panel-buttons">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button className="end-turn" disabled={problem !== undefined} onClick={() => onStart(party)}>
          Start run
        </button>
      </div>
    </div>
  );
}

/** Every owned character; one opens her page. */
export function Roster({ owned, onBack }: { owned: readonly string[]; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <CharacterPage id={open} onBack={() => setOpen(null)} />;
  return (
    <div className="roster-screen">
      <h2 className="panel-title">Roster</h2>
      <div className="roster-grid">
        {owned.map((id) => (
          <Tile key={id} id={id} onClick={() => setOpen(id)} />
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

/** A character's stats and kit, with the numbers her stats fix. */
function CharacterPage({ id, onBack }: { id: string; onBack: () => void }) {
  const def = registry.characters[id];
  if (!def) return null;
  const kit = describeCharacter(def);
  const cards = def.cards.map((c) => registry.cards[c]).filter((c): c is CardDef => c !== undefined);
  const rewards = Object.values(registry.cards).filter((c) => c.reward && c.owner === id);
  const face = (card: CardDef) => (
    <CardFace
      key={card.id}
      id={card.id}
      def={card}
      owner={def}
      text={runCardText({ card: card.id, owner: id }, registry, { charge: false, keywords: false, mark: markNumber })}
      cost={card.cost}
      registry={registry}
      playable
    />
  );
  const art = battleArt[id];
  return (
    <div className={`character-page domain-${def.domain}`} aria-label={def.name}>
      <div className="character-art">{art && <img src={art} alt="" draggable={false} />}</div>
      <div className="character-info">
        <h2>{fullName(id)}</h2>
        <p className="character-domain">{DOMAIN_LABEL[def.domain] ?? def.domain}</p>
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
      </div>
      <div className="panel-buttons character-back">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
