import { useState } from 'react';
import { registry } from '../content/registry.ts';
import { routeTo, visibleKind, type Board, type TileKind } from '../game/board.ts';
import { parseHex, type Hex } from '../game/hex.ts';
import { WIDTH } from '../stage/layout.ts';

// The Labyrinth board as SVG hexes: only revealed tiles are drawn, hovering one shows the route
// the party would walk, and clicking walks it. The camera keeps the party's tile in the middle, so
// the board's extent never hints where the Boss is (owner). Colours and labels stand in until the
// map art pass.

type Shown = TileKind | 'unknown';

const LABEL: Readonly<Record<Shown, string>> = {
  entrance: 'Entrance',
  path: '',
  fight: 'Fight',
  elite: 'Elite',
  boss: 'Boss',
  event: 'Event',
  shop: 'Shop',
  camp: 'Camp',
  symptom: 'Symptom',
  collapsing: 'Collapsing',
  ruin: '',
  bloom: 'Bloom',
  unknown: '?',
};

/** Hex radius in frame pixels. */
const SIZE = 56;
/** Where the party's tile sits: the middle of the map area, between the top and bottom plaques. */
const MIDDLE = { x: WIDTH / 2, y: 530 };
/** The Boss marker rides this ellipse around the middle, inside the plaques. */
const EDGE = { x: 840, y: 330 };
const SQRT3 = Math.sqrt(3);

interface Props {
  board: Board;
  /** While the party walks, the map shows but takes no input. */
  busy: boolean;
  /** The Boss tile, once the Bloom shows the way: a marker points to it while it is fogged or off screen. */
  boss?: string | undefined;
  onPick: (key: string) => void;
}

export function LabyrinthMap({ board, busy, boss, onPick }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const route = hover && !busy ? routeTo(board, hover) : undefined;
  const steps = new Map(route?.map((key, i) => [key, i + 1]));
  const party = centre(parseHex(board.at));

  return (
    <>
      <svg className="labyrinth-map" viewBox={`0 0 ${WIDTH} 1080`} onPointerLeave={() => setHover(null)}>
        {/* A style transform, so CSS eases the board under the party as it walks. */}
        <g className="map-camera" style={{ transform: `translate(${MIDDLE.x - party.x}px, ${MIDDLE.y - party.y}px)` }}>
          {board.seen.map((key) => {
            const shown = visibleKind(board, key)!;
            const tile = board.tiles[key]!;
            const { x, y } = centre(parseHex(key));
            const reachable = !busy && key !== board.at && routeTo(board, key) !== undefined;
            const classes = ['hex', `hex-${shown}`, tile.paid ? 'paid' : '', steps.has(key) ? 'on-route' : '', reachable ? 'reachable' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <g
                key={key}
                className={classes}
                transform={`translate(${x} ${y})`}
                onPointerEnter={() => setHover(key)}
                onClick={() => reachable && onPick(key)}
                data-tile={key}
                data-kind={shown}
              >
                <polygon points={corners(SIZE * 0.94)} />
                {LABEL[shown] && key !== board.at && (
                  <text className="hex-label" y={5}>
                    {tile.paid ? 'Paid' : LABEL[shown]}
                  </text>
                )}
                {steps.has(key) && (
                  <text className="hex-step" y={-SIZE * 0.42}>
                    {steps.get(key)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <g className="party-token" transform={`translate(${MIDDLE.x} ${MIDDLE.y})`}>
          <circle r={SIZE * 0.42} />
        </g>
        {boss && <BossMarker board={board} boss={boss} />}
      </svg>
      {hover && <TileInfo board={board} at={hover} steps={route?.length} busy={busy} />}
    </>
  );
}

/** An arrow at the edge of the view toward the Boss, unless its tile is revealed and on screen. */
function BossMarker({ board, boss }: { board: Board; boss: string }) {
  const party = centre(parseHex(board.at));
  const at = centre(parseHex(boss));
  const dx = at.x - party.x;
  const dy = at.y - party.y;
  if (board.seen.includes(boss) && (dx / EDGE.x) ** 2 + (dy / EDGE.y) ** 2 <= 1) return null;
  const angle = Math.atan2(dy / EDGE.y, dx / EDGE.x);
  const x = MIDDLE.x + EDGE.x * Math.cos(angle);
  const y = MIDDLE.y + EDGE.y * Math.sin(angle);
  return (
    <g className="boss-marker" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} data-boss-marker>
      <polygon points="22,0 -12,-15 -4,0 -12,15" transform={`rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)})`} />
      <text y={36}>Boss</text>
    </g>
  );
}

/** What the hovered tile is, and how far. */
function TileInfo({ board, at, steps, busy }: { board: Board; at: string; steps: number | undefined; busy: boolean }) {
  const shown = visibleKind(board, at);
  if (!shown) return null;
  const tile = board.tiles[at]!;
  const encounter = tile.content ? registry.encounters[tile.content] : undefined;
  const enemies = encounter?.enemies.map((e) => registry.enemies[typeof e === 'string' ? e : e.enemy]?.name ?? '?');
  const known = shown !== 'unknown';
  return (
    <div className="tile-info plaque" role="status">
      <strong>{known ? NAME[shown] : 'Unexplored'}</strong>
      {known && enemies && <span>{listOf(enemies)}</span>}
      {known && shown === 'symptom' && (tile.paid ? <span>Paid: free to pass.</span> : tile.card && <span>{registry.cards[tile.card]?.name}</span>)}
      {known && shown === 'event' && tile.content && <span>{registry.events[tile.content]?.name}</span>}
      {known && HELP[shown] && <span className="muted">{HELP[shown]}</span>}
      {!busy && at !== board.at && <span className="muted">{steps === undefined ? 'No way there from here.' : `${steps} ${steps === 1 ? 'step' : 'steps'}`}</span>}
    </div>
  );
}

const NAME: Readonly<Record<Shown, string>> = {
  ...LABEL,
  path: 'Path',
  ruin: 'Collapsed',
  unknown: 'Unexplored',
};

const HELP: Partial<Record<Shown, string>> = {
  collapsing: 'Gone once you step off it.',
  ruin: 'Impassable.',
  symptom: 'Take its card to pass.',
  shop: 'Keeps its stock all run.',
  camp: 'One use: rest now or keep it for later.',
  bloom: 'Choose one: its fight, a gamble on 10% of current HP, or a Symptom.',
};

export function listOf(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const parts = [...counts].map(([n, c]) => (c > 1 ? `${c} × ${n}` : n));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

/** Pointy-top hex corners around 0,0. */
function corners(radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(radius * Math.cos(a)).toFixed(1)},${(radius * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** A hex's centre on the board, in frame pixels from the board's origin. */
function centre(h: Hex) {
  return { x: SQRT3 * (h.q + h.r / 2) * SIZE, y: 1.5 * h.r * SIZE };
}
