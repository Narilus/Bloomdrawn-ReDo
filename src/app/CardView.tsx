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
  // The charge shows as a tag, so the text box holds only the card's effect.
  const text = describeCardLive(card, state, registry, { charge: false });
  const length = text.length > 95 ? ' text-xlong' : text.length > 55 ? ' text-long' : '';
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
      <div className="card-text">{text}</div>
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
