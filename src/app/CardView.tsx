import { cardCost, describeCardLive, type CardInstance, type CombatState, type Registry } from '../engine/index.ts';
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

/** A card face. All numbers come from the engine's live description. */
export function CardView({ card, state, registry, playable, keyHint, highlight }: Props) {
  const def = registry.cards[card.card];
  const member = state.members.find((m) => m.id === card.owner);
  const owner = member ? registry.characters[member.character] : undefined;
  const portrait = owner ? portraitArt[owner.id] : undefined;
  const domain = owner?.domain ?? '';
  // Keywords and the charge show as tags, so the text box holds only the card's effect.
  const text = describeCardLive(card, state, registry, { charge: false, keywords: false, mark });
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
      <CostGem printed={def?.cost} now={def ? cardCost(state, card, registry) : undefined} />
      <div className="card-name">{def?.name ?? card.card}</div>
      <div className="card-art">
        {portrait ? <img src={portrait} alt="" draggable={false} /> : <span className="monogram">{owner?.name.charAt(0)}</span>}
      </div>
      <div className="card-type">
        {owner?.name} · {DOMAIN_LABEL[domain] ?? domain}
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
const mark = (text: string, value?: 'damage' | 'shield') => `⟦${value ?? ''}:${text}⟧`;

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
