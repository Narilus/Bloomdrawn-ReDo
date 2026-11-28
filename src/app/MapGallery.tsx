import { mapArt, type MapArt } from '../stage/mapArt.ts';
import { HexDefs, HexTile, hexCentre, MapArtContext, PartyToken, type Shown } from './LabyrinthMap.tsx';

// Dev builds only: `?maptiles` shows a strip of every kind of Labyrinth tile on each band's floor,
// with the game's own art. `?maptiles&rows=[{"label":…,"floor":url,"icons":{"fight":url,…}},…]`
// shows options instead, one strip a row, for the owner to pick (`npm run art -- maptiles`).

const params = () => (import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams());

export const mapGalleryRequested = params().has('maptiles');

interface Row {
  label: string;
  floor?: string;
  icons?: Record<string, string>;
}

/** Two rows of hexes holding every kind once, a paid Symptom, and the party on a path tile. */
const STRIP: readonly (readonly [string, Shown, boolean?])[] = [
  ['0,0', 'entrance'],
  ['1,0', 'path'],
  ['2,0', 'fight'],
  ['3,0', 'elite'],
  ['4,0', 'boss'],
  ['5,0', 'event'],
  ['6,0', 'shop'],
  ['7,0', 'camp'],
  ['-1,1', 'path'],
  ['0,1', 'symptom'],
  ['1,1', 'symptom', true],
  ['2,1', 'collapsing'],
  ['3,1', 'bloom'],
  ['4,1', 'ruin'],
  ['5,1', 'unknown'],
  ['6,1', 'path'],
];
const PARTY = '-1,1';

function rows(): Row[] {
  const given = params().get('rows');
  if (given) return JSON.parse(given) as Row[];
  return [1, 2, 3, 4, 5].map((band) => {
    const floor = mapArt.floor(band);
    return floor ? { label: `band ${band}`, floor } : { label: `band ${band}` };
  });
}

function Strip({ row }: { row: Row }) {
  const art: MapArt = { floor: () => row.floor, icon: (kind) => row.icons?.[kind] ?? mapArt.icon(kind) };
  const party = hexCentre(PARTY);
  return (
    <MapArtContext.Provider value={art}>
      <section className="map-gallery-row">
        <h3>{row.label}</h3>
        <svg viewBox="-120 -80 1000 250" className={row.floor ? 'has-floor' : undefined}>
          <HexDefs />
          {STRIP.map(([key, shown, paid]) => {
            const { x, y } = hexCentre(key);
            return <HexTile key={key} at={key} shown={shown} floor={row.floor} classes={`hex hex-${shown}${paid ? ' paid' : ''}`} x={x} y={y} paid={paid === true} current={key === PARTY} step={undefined} />;
          })}
          <PartyToken x={party.x} y={party.y} />
        </svg>
      </section>
    </MapArtContext.Provider>
  );
}

export function MapGallery() {
  return (
    <div className="map-gallery">
      {rows().map((row) => (
        <Strip key={row.label} row={row} />
      ))}
    </div>
  );
}
