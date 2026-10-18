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
  return (
    <div
      className={`card domain-${domain}${playable ? '' : ' unplayable'}${highlight ? ' highlight' : ''}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <div className="card-cost">{def ? cardCost(state, card, registry) : '?'}</div>
      <div className="card-name">{def?.name ?? card.card}</div>
      <div className="card-art">
        {portrait ? <img src={portrait} alt="" draggable={false} /> : <span className="monogram">{owner?.name.charAt(0)}</span>}
      </div>
      <div className="card-type">
        {owner?.name} · {DOMAIN_LABEL[domain] ?? domain}
      </div>
      <div className="card-text">{describeCardLive(card, state, registry)}</div>
      {keyHint && <div className="card-key">{keyHint}</div>}
    </div>
  );
}
