import { registry } from '../content/registry.ts';
import { runCardText } from '../game/expedition.ts';
import { frameArt, type FramePieces } from '../stage/frameArt.ts';
import { CardFace, FrameArtContext, markNumber } from './CardView.tsx';
import { CARD_EM, RAISED_SCALE } from './fan.ts';

// Dev builds only: `?cards` shows each frame on sample cards, at the hand's size and raised, with
// the game's own ornament. `?cards&kit=frame-flesh-01,frame-flesh-02` shows frame-kit options
// instead, from their pieces in art/cut/frames/ (`npm run art -- frames`), for the owner to pick.

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());

export const galleryRequested = params().has('cards');

/** Two cards per frame, shown as if held for a turn, so a Ritual shows its lower cost. */
const SAMPLES: Record<string, readonly [string, string]> = {
  flesh: ['maelia.strike', 'virelle.open-the-wound'],
  rapture: ['agathe.censer-rite', 'isadora.the-veil-torn'],
  spirit: ['kibane.foxfire-rite', 'anthe.defense'],
  unbound: ['leonora.promissory-note', 'hester.iron-hooks'],
  bloom: ['symptom.pollen-lung', 'symptom.sweet-rot'],
};

interface Option {
  label: string;
  frame: string;
  pieces?: FramePieces;
}

function options(): Option[] {
  const kits = params().get('kit')?.split(',').filter(Boolean) ?? [];
  if (kits.length === 0) return Object.keys(SAMPLES).map((frame) => ({ label: frame, frame }));
  return kits.map((kit) => {
    const frame = /^frame-([a-z]+)-\d+$/.exec(kit)?.[1] ?? 'bloom';
    const at = (piece: string) => `/art/cut/frames/${kit}/${piece}.png`;
    return { label: kit.replace(/^frame-/, ''), frame, pieces: { corner: at('corner'), crest: at('crest'), side: at('side') } };
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

export function CardGallery() {
  return (
    <div className="card-gallery">
      {options().map(({ label, frame, pieces }) => {
        const [plain, tagged] = SAMPLES[frame] ?? (SAMPLES.bloom as readonly [string, string]);
        return (
          <FrameArtContext.Provider key={label} value={(f) => (pieces && f === frame ? pieces : frameArt(f))}>
            <section className="card-gallery-option">
              <h3>{label}</h3>
              <div className="card-gallery-cards">
                <Sample id={plain} em={CARD_EM} held />
                <Sample id={tagged} em={CARD_EM} held />
                <Sample id={plain} em={CARD_EM * RAISED_SCALE} held />
              </div>
            </section>
          </FrameArtContext.Provider>
        );
      })}
    </div>
  );
}
