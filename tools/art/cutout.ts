import { blank, crop, scaleArea, type Rgba } from './image.ts';

export type Colour = readonly [number, number, number];

/** Below this distance from the key colour a pixel is background; above OUTER it is solid. */
const INNER = 70;
const OUTER = 150;

export function hasAlpha(image: Rgba): boolean {
  for (let i = 3; i < image.data.length; i += 4) if ((image.data[i] ?? 255) < 255) return true;
  return false;
}

/** The background colour of a chroma-key image: the per-channel median of its outermost pixels. */
export function keyColour(image: Rgba): Colour {
  const channels: [number[], number[], number[]] = [[], [], []];
  const take = (x: number, y: number) => {
    const i = (y * image.width + x) * 4;
    for (let c = 0; c < 3; c++) channels[c as 0 | 1 | 2].push(image.data[i + c] ?? 0);
  };
  for (let x = 0; x < image.width; x++) {
    take(x, 0);
    take(x, image.height - 1);
  }
  for (let y = 1; y < image.height - 1; y++) {
    take(0, y);
    take(image.width - 1, y);
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] ?? 0;
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

/**
 * Keys out a flat background. Pixels near the key colour become transparent anywhere in the
 * image (so gaps between an arm and the body clear too). Pixels bordering the background are a
 * blend of figure and key: each is un-mixed against the nearby figure colour that best explains
 * it, which gives both its alpha and its true colour. Interior colours that merely resemble the
 * key stay solid.
 */
export function chromaKey(image: Rgba, key: Colour): Rgba {
  const { width, height, data } = image;
  const out = { width, height, data: new Uint8Array(data) };
  const distance = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    distance[p] = Math.hypot((data[p * 4] ?? 0) - key[0], (data[p * 4 + 1] ?? 0) - key[1], (data[p * 4 + 2] ?? 0) - key[2]);
  }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? y * width + x : -1);
  const nearBackground = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const q = at(x + dx, y + dy);
      if (q >= 0 && (distance[q] ?? Infinity) < INNER) return true;
    }
    return false;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const d = distance[p] ?? 0;
      if (d < INNER) out.data.set([0, 0, 0, 0], p * 4);
      else if (nearBackground(x, y)) unmix(data, out.data, p, key, neighbours(x, y, d));
    }
  }
  return out;

  // Candidate figure colours: nearby pixels further from the key than this one.
  function neighbours(x: number, y: number, d: number): number[] {
    const found: number[] = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const q = at(x + dx, y + dy);
      if (q >= 0 && (distance[q] ?? 0) >= Math.max(OUTER, d + 1)) found.push(q);
    }
    return found;
  }
}

/** Solves observed = alpha·figure + (1 − alpha)·key for the candidate that fits best. */
function unmix(source: Uint8Array, target: Uint8Array, p: number, key: Colour, candidates: number[]) {
  const observed = [0, 1, 2].map((c) => (source[p * 4 + c] ?? 0) - key[c as 0 | 1 | 2]);
  let best: { alpha: number; residual: number; q: number } | null = null;
  for (const q of candidates) {
    const figure = [0, 1, 2].map((c) => (source[q * 4 + c] ?? 0) - key[c as 0 | 1 | 2]);
    const length = figure.reduce((sum, v) => sum + v * v, 0);
    const alpha = Math.max(0, Math.min(1, observed.reduce((sum, v, c) => sum + v * (figure[c] ?? 0), 0) / length));
    const residual = observed.reduce((sum, v, c) => sum + (v - alpha * (figure[c] ?? 0)) ** 2, 0);
    if (!best || residual < best.residual) best = { alpha, residual, q };
  }
  const own = Math.hypot(...observed);
  if (!best) {
    // No solid colour nearby (a thin strand): fall back to distance from the key.
    if (own < OUTER) target[p * 4 + 3] = Math.round(((own - INNER) / (OUTER - INNER)) * 255);
    return;
  }
  if (best.alpha >= 0.92) return;
  target.set([source[best.q * 4] ?? 0, source[best.q * 4 + 1] ?? 0, source[best.q * 4 + 2] ?? 0, Math.round(best.alpha * 255)], p * 4);
}

/**
 * Generator alpha is a soft matte: the figure itself sits at 251–254, not 255. Snap
 * near-solid to solid and near-clear to clear, leaving the soft edge between.
 */
export function normaliseAlpha(image: Rgba): Rgba {
  const out = { ...image, data: new Uint8Array(image.data) };
  for (let i = 3; i < out.data.length; i += 4) {
    const a = out.data[i] ?? 0;
    if (a >= 240) out.data[i] = 255;
    else if (a <= 12) out.data.set([0, 0, 0, 0], i - 3);
  }
  return out;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The bounding box of pixels at least `threshold` opaque, or null if there are none. */
export function opaqueBounds(image: Rgba, threshold = 32): Box | null {
  let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) < threshold) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Crops to the figure with `pad` transparent pixels on every side. */
export function trim(image: Rgba, pad: number): Rgba {
  const box = opaqueBounds(image);
  if (!box) return blank(1, 1);
  return crop(image, box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2);
}

/** Background removal, then trim with a 2% margin. */
export function cutout(image: Rgba): Rgba {
  const clear = hasAlpha(image) ? normaliseAlpha(image) : chromaKey(image, keyColour(image));
  const box = opaqueBounds(clear);
  return trim(clear, Math.round((box?.height ?? 0) * 0.02));
}

/**
 * Game sprites are stored at one standard height, at least as tall as the largest size they are
 * drawn at (a front-row party member on a 4K screen); the stage downscales from there.
 */
export const SPRITE_HEIGHT = 1024;

export function standardise(image: Rgba): Rgba {
  if (image.height <= SPRITE_HEIGHT) return image;
  return scaleArea(image, Math.round((image.width * SPRITE_HEIGHT) / image.height), SPRITE_HEIGHT);
}
