import { createContext, useContext } from 'react';
import { cardCost, cardKeywords, describeCardLive, type CardDef, type CardInstance, type CardTarget, type CharacterDef, type CombatState, type Registry } from '../engine/index.ts';
import { portraitArt } from '../stage/art.ts';
import { cardArt } from '../stage/cardArt.ts';
import { frameArt, type FramePieces } from '../stage/frameArt.ts';

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
  const printed = registry.cards[card.card];
  // A created copy can carry its own cost and keywords (a Fleeting Strike costing 0).
  const def = printed && { ...printed, cost: card.cost ?? printed.cost, keywords: [...new Set(cardKeywords(card, registry))] };
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

const TARGET_LABEL: Record<CardTarget, string> = {
  none: 'No target',
  self: 'Self',
  party: 'Party',
  chosenEnemy: 'Single enemy',
  allEnemies: 'All enemies',
};

/**
 * A card face, in combat or offered as a reward (DESIGN.md "Cards"; owner, 28 Nov). The caller works
 * out its text and cost. The layout never changes: down the left the cost, the owner's medallion,
 * her name and the Domain sigil; the art window; the title; the tags and target; the rules on parchment.
 * The frame is drawn around them from separate ornament pieces.
 */
export function CardFace({ id, def, owner, text, cost, registry, playable, keyHint, highlight }: FaceProps) {
  // The party's own cards (Symptoms) are played by the front member, but belong to no one.
  const ownerless = def !== undefined && def.owner === undefined && def.domain === undefined;
  // A Domain's generic card shows its own Domain, whoever owns it.
  const domain = ownerless ? 'bloom' : (def?.domain ?? owner?.domain ?? 'bloom');
  const portrait = owner && !ownerless ? portraitArt[owner.id] : undefined;
  const art = def ? cardArt(def, ownerless ? undefined : domain) : undefined;
  const plain = text.replace(MARK, '$2');
  const length = plain.length > 130 ? ' text-xlong' : plain.length > 90 ? ' text-long' : '';
  const name = def?.name ?? id;
  // The type line's tags: what kind of card it is beyond its effect. Most cards have none.
  const tags = def
    ? [
        ...(ownerless ? ['Symptom'] : []),
        ...(def.slot === 'transcend' ? ['Transcend'] : []),
        ...(def.keywords ?? []).map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
      ].join(' · ')
    : '';
  return (
    <div className={`card frame-${domain}${playable ? '' : ' unplayable'}${highlight ? ' highlight' : ''}${length}`}>
      <div className="card-art">{art ? <img src={art} alt="" draggable={false} /> : <ArtPlaceholder domain={domain} />}</div>
      <div className="card-column">
        <CostGem printed={def?.cost} now={cost} />
        <div className="card-medal face-crop">
          {ownerless ? (
            <BloomEmblem />
          ) : portrait ? (
            <img src={portrait} alt="" draggable={false} />
          ) : (
            <span className="card-initial">{owner?.name.charAt(0)}</span>
          )}
        </div>
        <span className="card-plate">{ownerless ? 'Party' : owner?.name}</span>
        <span className="card-sigil" title={DOMAIN_LABEL[domain] ?? 'The Bloom'}>
          <Sigil domain={domain} />
        </span>
      </div>
      <div className={`card-title${name.length > 15 ? ' long' : ''}`}>
        <span className="card-name">{name}</span>
      </div>
      <div className="card-typeline">
        <span className="card-type">{tags}</span>
        <span className="card-target">{def ? TARGET_LABEL[def.target] : ''}</span>
      </div>
      <div className="card-text">
        <RulesText text={text} registry={registry} />
      </div>
      {def?.charge && (
        <div className="card-charge" title={`Charges its owner's ultimate by ${def.charge}`}>
          Ult +{def.charge}
        </div>
      )}
      <CardFrame frame={domain} />
      {keyHint && <div className="card-key">{keyHint}</div>}
    </div>
  );
}

/** The frame pieces to draw: the game's own, or options under review in the dev card gallery. */
export const FrameArtContext = createContext<(frame: string) => FramePieces>(frameArt);

/**
 * The frame, built from pieces around the fixed text areas: the rim, the inner rule, both sides,
 * three corners (the cost gem holds the fourth) and the crest. A piece without ornament art yet
 * keeps its drawn stand-in.
 */
function CardFrame({ frame }: { frame: string }) {
  const art = useContext(FrameArtContext)(frame);
  const piece = (url: string) => ({ backgroundImage: `url(${url})` });
  return (
    <div className="card-frame" aria-hidden="true">
      <div className="frame-rim" />
      <div className="frame-rule" />
      {art.side && (['left', 'right'] as const).map((side) => <div key={side} className={`frame-side ${side}`} style={piece(art.side!)} />)}
      {(['tr', 'bl', 'br'] as const).map((corner) =>
        art.corner ? (
          <div key={corner} className={`frame-corner art ${corner}`} style={piece(art.corner)} />
        ) : (
          <svg key={corner} className={`frame-corner ${corner}`} viewBox="0 0 40 40">
            <path d="M3 37 C3 15, 15 3, 37 3" />
            <path d="M9 37 C9 20, 20 9, 37 9" />
            <circle cx="9" cy="9" r="2.6" />
          </svg>
        ),
      )}
      {art.crest ? <div className="frame-crest art" style={piece(art.crest)} /> : <div className="frame-crest" />}
    </div>
  );
}

/** Until the card has its own picture: the Domain's glow with its sigil, right of centre. */
function ArtPlaceholder({ domain }: { domain: string }) {
  return (
    <div className="card-art-placeholder">
      <Sigil domain={domain} />
    </div>
  );
}

// Stand-in sigils from the owner's mockup, one shape per Domain; the Bloom's is the party's.
const SIGILS: Record<string, React.ReactNode> = {
  flesh: (
    <>
      <path d="M12 3 C 17 9, 18 13, 12 21 C 6 13, 7 9, 12 3 Z" />
      <path d="M12 9 v6" />
    </>
  ),
  rapture: <path d="M11 12 a1 1 0 1 1 2 0 a3 3 0 1 1 -5 -2 a6 6 0 1 1 9 6" />,
  spirit: <path d="M12 3 C 15 8, 18 10, 15 16 C 14 19, 10 19, 9 16 C 7 12, 10 10, 12 3 Z" />,
  unbound: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M5 12 h14" />
    </>
  ),
  bloom: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
};

function Sigil({ domain }: { domain: string }) {
  return (
    <svg className="sigil" viewBox="0 0 24 24" aria-hidden="true">
      {SIGILS[domain] ?? SIGILS.bloom}
    </svg>
  );
}

/** In place of an owner's face on the party's own cards: a Bloom flower. */
function BloomEmblem() {
  return (
    <svg className="sigil bloom-emblem" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3 C 15 6, 15 8, 12 9 C 9 8, 9 6, 12 3 Z M12 21 C 15 18, 15 16, 12 15 C 9 16, 9 18, 12 21 Z M3 12 C 6 9, 8 9, 9 12 C 8 15, 6 15, 3 12 Z M21 12 C 18 9, 16 9, 15 12 C 16 15, 18 15, 21 12 Z" />
    </svg>
  );
}

/**
 * The cost to pay now, in a gem. When it is lower (a held Ritual), the gem turns gold and glows, and
 * the printed cost sits in a badge at its lower right, struck through; when it is higher, the gem
 * turns red and the badge shows the same.
 */
function CostGem({ printed, now }: { printed: number | undefined; now: number | undefined }) {
  const changed = printed !== undefined && now !== undefined && now !== printed;
  return (
    <div className={`card-cost${changed ? (now < printed ? ' cheaper' : ' dearer') : ''}`} aria-label={`Cost ${now ?? '?'}`}>
      <div className="gem">
        <span className="gem-number">{now ?? '?'}</span>
      </div>
      {changed && (
        <s className="printed-cost" aria-label={`printed cost ${printed}`}>
          <span>{printed}</span>
        </s>
      )}
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
