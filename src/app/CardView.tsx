import { cardCost, describeCardLive, type CardDef, type CardInstance, type CharacterDef, type CombatState, type Registry } from '../engine/index.ts';
import { portraitArt } from '../stage/art.ts';
import { CARD_H, CARD_W } from './fan.ts';

const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

interface Props {
  card: CardInstance;
  state: CombatState;
  registry: Registry;
  playable: boolean;
  keyHint?: string | undefined;
  highlight?: boolean;
}

/** A card in combat. All numbers come from the engine's live description. */
export function CardView({ card, state, registry, playable, keyHint, highlight }: Props) {
  const def = registry.cards[card.card];
  const member = state.members.find((m) => m.id === card.owner);
  // Keywords and the charge show as tags, so the text box holds only the card's effect.
  const text = describeCardLive(card, state, registry, { charge: false, keywords: false, mark: markNumber });
  return (
    <CardFace
      id={card.card}
      def={def}
      owner={member ? registry.characters[member.character] : undefined}
      text={text}
      cost={def ? cardCost(state, card, registry) : undefined}
      registry={registry}
      playable={playable}
      keyHint={keyHint}
      highlight={highlight}
    />
  );
}

interface FaceProps {
  id: string;
  def: CardDef | undefined;
  /** The character who plays it. */
  owner: CharacterDef | undefined;
  /** Its effect, with numbers wrapped by `markNumber`, and without keywords or the charge. */
  text: string;
  /** The cost to pay now. */
  cost: number | undefined;
  registry: Registry;
  playable: boolean;
  keyHint?: string | undefined;
  highlight?: boolean | undefined;
}

/** A card face, in combat or offered as a reward. The caller works out its text and cost. */
export function CardFace({ id, def, owner, text, cost, registry, playable, keyHint, highlight }: FaceProps) {
  const portrait = owner ? portraitArt[owner.id] : undefined;
  // The party's own cards (Symptoms) are played by the front member.
  const symptom = def !== undefined && def.owner === undefined && def.domain === undefined;
  // A Domain's generic card shows its own Domain, whoever owns it.
  const domain = symptom ? 'symptom' : (def?.domain ?? owner?.domain ?? '');
  const plain = text.replace(MARK, '$2');
  const length = plain.length > 95 ? ' text-xlong' : plain.length > 55 ? ' text-long' : '';
  const tags = [
    ...(def?.slot === 'transcend' ? ['Transcend'] : []),
    ...(def?.keywords ?? []).map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
  ];
  return (
    <div
      className={`card domain-${domain}${playable ? '' : ' unplayable'}${highlight ? ' highlight' : ''}${length}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <CostGem printed={def?.cost} now={cost} />
      <div className="card-name">{def?.name ?? id}</div>
      <div className="card-art">
        {portrait ? <img src={portrait} alt="" draggable={false} /> : <span className="monogram">{owner?.name.charAt(0)}</span>}
      </div>
      <div className="card-type">
        {symptom ? `Symptom · ${owner?.name}` : `${owner?.name} · ${DOMAIN_LABEL[domain] ?? domain}`}
      </div>
      {tags.length > 0 && (
        <div className="card-keywords">
          {tags.map((k) => (
            <span key={k} className={`keyword keyword-${k.toLowerCase()}`}>
              {k}
            </span>
          ))}
        </div>
      )}
      <div className="card-text">
        <RulesText text={text} registry={registry} />
      </div>
      {def?.charge && (
        <div className="card-charge" title={`Charges her ultimate by ${def.charge}`}>
          Ult +{def.charge}
        </div>
      )}
      {keyHint && <div className="card-key">{keyHint}</div>}
    </div>
  );
}

/** The cost to pay now; when it differs, the printed cost sits beside it, struck through. */
function CostGem({ printed, now }: { printed: number | undefined; now: number | undefined }) {
  const changed = printed !== undefined && now !== undefined && now !== printed;
  return (
    <div className={`card-cost${changed ? (now < printed ? ' cheaper' : ' dearer') : ''}`} aria-label={`Cost ${now ?? '?'}`}>
      {now ?? '?'}
      {changed && <s className="printed-cost">{printed}</s>}
    </div>
  );
}

// Live numbers arrive wrapped as ⟦kind:text⟧ so they can be coloured by kind.
const MARK = /⟦(\w*):([^⟧]*)⟧/g;
export const markNumber = (text: string, value?: 'damage' | 'shield') => `⟦${value ?? ''}:${text}⟧`;

/** Card text with damage and Shield numbers and status names highlighted. The words carry the meaning; colour only helps. */
function RulesText({ text, registry }: { text: string; registry: Registry }) {
  const statuses = Object.keys(registry.statuses).map((id) => id.replace(/^status\./, '').replace(/^./, (c) => c.toUpperCase()));
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    parts.push(...withStatuses(text.slice(last, m.index), statuses, parts.length));
    parts.push(
      <b key={parts.length} className={m[1] ? `num-${m[1]}` : 'num'}>
        {m[2]}
      </b>,
    );
    last = m.index + m[0].length;
  }
  parts.push(...withStatuses(text.slice(last), statuses, parts.length));
  // One span, so the centred text box lays it out as a single paragraph.
  return <span>{parts}</span>;
}

function withStatuses(text: string, statuses: string[], key: number): React.ReactNode[] {
  if (statuses.length === 0) return [text];
  const pattern = new RegExp(`\\b(${statuses.join('|')})\\b`, 'g');
  return text.split(pattern).map((piece, i) =>
    i % 2 === 1 ? (
      <b key={`${key}-${i}`} className={`status-word status-${piece.toLowerCase()}`}>
        {piece}
      </b>
    ) : (
      piece
    ),
  );
}
