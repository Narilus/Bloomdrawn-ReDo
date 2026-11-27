import { trim } from './cutout.ts';
import { blank, type Rgba } from './image.ts';

// A card-frame kit (M6.11a; DESIGN.md "Ornament stem"): one transparent image holding three pieces
// set apart, a corner at the top left, a crest at the top right and a long border strip along the
// bottom. The game builds the frame from them, so each is cut out on its own.

export interface Kit {
  /** Its outer corner at the top left; the game mirrors it into the other corners. */
  corner: Rgba;
  crest: Rgba;
  /** Turned to run top to bottom, for the card's long sides. */
  side: Rgba;
}

type Piece = keyof Kit;

/** Which piece a main blob is, by where its centre lies in the kit's layout. */
function pieceAt(x: number, y: number, width: number, height: number): Piece {
  if (y > height * 0.55) return 'side';
  return x < width / 2 ? 'corner' : 'crest';
}

interface Blob {
  members: number[];
  x: number;
  y: number;
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** How far a point lies outside a box (0 inside it). */
const distance = ({ x0, y0, x1, y1 }: Blob['box'], x: number, y: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

/** Pixels at least this opaque join blobs; fainter ones (a soft glow or haze) only follow the nearest piece. */
const SOLID = 96;

/** Every connected blob of solid pixels (8-connected), with its opacity-weighted centre and its box. */
function blobs({ width, height, data }: Rgba): Blob[] {
  const seen = new Uint8Array(width * height);
  const found: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || (data[start * 4 + 3] ?? 0) < SOLID) continue;
    const members: number[] = [];
    const box = { x0: width, y0: height, x1: 0, y1: 0 };
    let sx = 0, sy = 0, sw = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop()!;
      members.push(at);
      const x = at % width;
      const y = (at - x) / width;
      const a = data[at * 4 + 3]!;
      sx += x * a;
      sy += y * a;
      sw += a;
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next] || (data[next * 4 + 3] ?? 0) < SOLID) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    found.push({ members, x: sx / sw, y: sy / sw, box });
  }
  return found;
}

/**
 * Splits a kit by its transparency. The biggest solid blob in each part of the layout is that piece;
 * every smaller blob (a petal or bell floating free) joins the piece whose box lies nearest its
 * centre, so a petal by the corner's long arm stays with the corner, and faint pixels (a glow that
 * runs between pieces) go to the nearest piece one by one.
 */
export function splitKit(image: Rgba): Kit {
  const { width, height, data } = image;
  const main: Partial<Record<Piece, Blob>> = {};
  const all = blobs(image).sort((a, b) => b.members.length - a.members.length);
  for (const blob of all) {
    const piece = pieceAt(blob.x, blob.y, width, height);
    main[piece] ??= blob;
  }
  const pieceList = Object.keys(main) as Piece[];
  const nearest = (x: number, y: number) => pieceList.reduce((best, p) => (distance(main[p]!.box, x, y) < distance(main[best]!.box, x, y) ? p : best));
  // Every visible pixel's piece: a blob's goes with its blob, a faint one with the nearest main piece.
  const owner = new Int8Array(width * height).fill(-1);
  for (const blob of all) {
    const index = pieceList.indexOf(nearest(blob.x, blob.y));
    for (const at of blob.members) owner[at] = index;
  }
  for (let at = 0; at < width * height; at++) {
    if (owner[at] !== -1 || (data[at * 4 + 3] ?? 0) === 0) continue;
    owner[at] = pieceList.indexOf(nearest(at % width, Math.floor(at / width)));
  }
  const cut = (piece: Piece): Rgba => {
    if (!main[piece]) throw new Error(`The kit has no ${piece}: its pieces may touch, or one is missing`);
    const index = pieceList.indexOf(piece);
    const out = blank(width, height);
    for (let at = 0; at < width * height; at++) if (owner[at] === index) out.data.set(data.subarray(at * 4, at * 4 + 4), at * 4);
    return trim(out, 2);
  };
  return { corner: cut('corner'), crest: cut('crest'), side: turn(cut('side')) };
}

/** A quarter turn clockwise: what ran left to right runs top to bottom. */
export function turn(image: Rgba): Rgba {
  const out = blank(image.height, image.width);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      out.data.set(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4), (x * out.width + (image.height - 1 - y)) * 4);
    }
  }
  return out;
}
