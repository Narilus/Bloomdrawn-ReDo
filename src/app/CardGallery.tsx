import { registry } from '../content/registry.ts';
import { runCardText } from '../game/expedition.ts';
import type { CardDef } from '../engine/index.ts';
import { cardArtName } from '../stage/cardArt.ts';
import { frameArt, type FramePieces } from '../stage/frameArt.ts';
import { CardArtContext, CardFace, FrameArtContext, markNumber } from './CardView.tsx';
import { CARD_EM, RAISED_SCALE } from './fan.ts';

// Dev builds only: `?cards` shows each frame on sample cards, at the hand's size and raised, with
// the game's own ornament. `?cards&kit=frame-flesh-01,transcend-flesh-02` shows frame-kit or
// Transcend-crest options instead, from their pieces in art/cut/frames/ (`npm run art -- frames`),
// for the owner to pick. `?cards&art=card-strike-flesh-01,card-strike-flesh-02` shows card-art options
// from art/raw/ (`npm run art -- cards`), each on a card that uses that picture.

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());

export const galleryRequested = params().has('cards');

/** Two cards per frame, shown as if held for a turn so a Ritual shows its lower cost; the second is a Transcend card. */
const SAMPLES: Record<string, readonly [string, string]> = {
  flesh: ['maelia.strike', 'maelia.ripened-womb'],
  rapture: ['agathe.censer-rite', 'isadora.the-veil-torn'],
  spirit: ['kibane.foxfire-rite', 'kibane.the-ninth-tail'],
  unbound: ['leonora.promissory-note', 'leonora.call-in-the-debts'],
  bloom: ['symptom.pollen-lung', 'symptom.fevered-pulse'],
};

interface Option {
  label: string;
  frame: string;
  pieces?: FramePieces;
  /** A Transcend-crest option: its Transcend card is the one shown raised. */
  crest?: boolean;
}

function options(): Option[] {
  const kits = params().get('kit')?.split(',').filter(Boolean) ?? [];
  if (kits.length === 0) return Object.keys(SAMPLES).map((frame) => ({ label: frame, frame }));
  return kits.map((kit) => {
    const [, kind, frame = 'bloom'] = /^(frame|transcend)-([a-z]+)-\d+$/.exec(kit) ?? [];
    const at = (piece: string) => `/art/cut/frames/${kit}/${piece}.png`;
    // A Transcend crest joins its frame's picked pieces; a kit replaces them.
    const pieces = kind === 'transcend' ? { ...frameArt(frame), transcend: at('transcend') } : { corner: at('corner'), crest: at('crest'), side: at('side') };
    return { label: kit.replace(/^frame-/, ''), frame, pieces, crest: kind === 'transcend' };
  });
}

function Sample({ id, em, held }: { id: string; em: number; held?: boolean }) {
  const def = registry.cards[id];
  const owner = def?.owner ? registry.characters[def.owner] : undefined;
  // A Ritual is shown held for a turn, its cost one lower.
  const cost = def && held && def.keywords?.includes('ritual') ? Math.max(0, def.cost - 1) : def?.cost;
  return (
    <div style={{ ['--card-em' as string]: `${em}px` }}>
      <CardFace
        id={id}
        def={def}
        owner={owner}
        text={runCardText(def?.owner ? { card: id, owner: def.owner } : { card: id }, registry, { charge: false, keywords: false, mark: markNumber })}
        cost={cost}
        registry={registry}
        playable
      />
    </div>
  );
}

/** The domain a card's picture is filed under, as CardFace works it out. */
function artDomain(def: CardDef): string | undefined {
  if (def.owner === undefined && def.domain === undefined) return undefined;
  return def.domain ?? (def.owner ? registry.characters[def.owner]?.domain : undefined);
}

/** Card-art options: each picture on the first card that uses it, at the hand's size and raised. */
function ArtOptions({ names }: { names: string[] }) {
  return (
    <div className="card-gallery">
      {names.map((name) => {
        const dir = name.replace(/-\d+$/, '');
        const url = `/art/raw/${dir}/${name}.png`;
        const wanted = dir.replace(/^card-/, '');
        const card = Object.values(registry.cards).find((def) => cardArtName(def, artDomain(def)) === wanted);
        if (!card) return <p key={name}>No card uses {wanted}.</p>;
        return (
          <CardArtContext.Provider key={name} value={(def, domain) => (cardArtName(def, domain) === wanted ? url : undefined)}>
            <section className="card-gallery-option">
              <h3>{name.replace(/^card-/, '')}</h3>
              <div className="card-gallery-cards">
                <Sample id={card.id} em={CARD_EM} />
                <Sample id={card.id} em={CARD_EM * RAISED_SCALE} />
              </div>
            </section>
          </CardArtContext.Provider>
        );
      })}
    </div>
  );
}

export function CardGallery() {
  const art = params().get('art')?.split(',').filter(Boolean) ?? [];
  if (art.length > 0) return <ArtOptions names={art} />;
  return (
    <div className="card-gallery">
      {options().map(({ label, frame, pieces, crest }) => {
        const [plain, tagged] = SAMPLES[frame] ?? (SAMPLES.bloom as readonly [string, string]);
        return (
          <FrameArtContext.Provider key={label} value={(f) => (pieces && f === frame ? pieces : frameArt(f))}>
            <section className="card-gallery-option">
              <h3>{label}</h3>
              <div className="card-gallery-cards">
                <Sample id={plain} em={CARD_EM} held />
                <Sample id={tagged} em={CARD_EM} held />
                <Sample id={crest ? tagged : plain} em={CARD_EM * RAISED_SCALE} held />
              </div>
            </section>
          </FrameArtContext.Provider>
        );
      })}
    </div>
  );
}
