import { useMemo, useState } from 'react';
import { registry } from '../content/registry.ts';
import { routeTo, visibleKind, type Board, type TileKind } from '../game/board.ts';
import { parseHex, type Hex } from '../game/hex.ts';
import { WIDTH } from '../stage/layout.ts';

// The Labyrinth board as SVG hexes: only revealed tiles are drawn, hovering one shows the route
// the party would walk, and clicking walks it. Colours and labels stand in until the map art pass.

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
  unknown: '?',
};

/** The map area inside the 1920×1080 frame, below the top plaques and above the bottom one. */
const AREA = { left: 80, top: 150, width: WIDTH - 160, height: 760 };
const SQRT3 = Math.sqrt(3);

interface Props {
  board: Board;
  /** While the party walks, the map shows but takes no input. */
  busy: boolean;
  onPick: (key: string) => void;
}

export function LabyrinthMap({ board, busy, onPick }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  // The whole board's extent fixes the scale, so the map never shifts as the fog lifts.
  const { size, centre } = useMemo(() => fitBoard(Object.keys(board.tiles).map(parseHex)), [board.tiles]);
  const route = hover && !busy ? routeTo(board, hover) : undefined;
  const steps = new Map(route?.map((key, i) => [key, i + 1]));
  const party = centre(parseHex(board.at));

  return (
    <>
      <svg className="labyrinth-map" viewBox={`0 0 ${WIDTH} 1080`} onPointerLeave={() => setHover(null)}>
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
              <polygon points={corners(size * 0.94)} />
              {LABEL[shown] && (
                <text className="hex-label" y={5}>
                  {tile.paid ? 'Paid' : LABEL[shown]}
                </text>
              )}
              {steps.has(key) && (
                <text className="hex-step" y={-size * 0.42}>
                  {steps.get(key)}
                </text>
              )}
            </g>
          );
        })}
        {/* A style transform, so CSS eases the token from tile to tile as the party walks. */}
        <g className="party-token" style={{ transform: `translate(${party.x}px, ${party.y}px)` }}>
          <circle r={size * 0.42} />
        </g>
      </svg>
      {hover && <TileInfo board={board} at={hover} steps={route?.length} busy={busy} />}
    </>
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
      {known && shown === 'symptom' && tile.paid && <span>Paid: free to pass.</span>}
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
};

function listOf(names: string[]): string {
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

/** The hex size that fits every tile in the map area, and where each hex's centre lands. */
function fitBoard(hexes: Hex[]) {
  const raw = (h: Hex) => ({ x: SQRT3 * (h.q + h.r / 2), y: 1.5 * h.r });
  const points = hexes.map(raw);
  const minX = Math.min(...points.map((p) => p.x)) - SQRT3 / 2;
  const maxX = Math.max(...points.map((p) => p.x)) + SQRT3 / 2;
  const minY = Math.min(...points.map((p) => p.y)) - 1;
  const maxY = Math.max(...points.map((p) => p.y)) + 1;
  const size = Math.min(56, AREA.width / (maxX - minX), AREA.height / (maxY - minY));
  const offsetX = AREA.left + (AREA.width - (maxX - minX) * size) / 2 - minX * size;
  const offsetY = AREA.top + (AREA.height - (maxY - minY) * size) / 2 - minY * size;
  return {
    size,
    centre: (h: Hex) => {
      const p = raw(h);
      return { x: offsetX + p.x * size, y: offsetY + p.y * size };
    },
  };
}
