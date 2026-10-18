import { describe, expect, it } from 'vitest';
import { chromaKey, cutout, keyColour, normaliseAlpha, opaqueBounds, pixelate, trim, type Colour } from './cutout.ts';
import { blank, fill, scaleArea, scaleNearest, type Rgba } from './image.ts';

const BLUE: Colour = [0, 2, 254];
const RED: Colour = [200, 30, 40];
const VIOLET: Colour = [110, 40, 200];

const pixel = (image: Rgba, x: number, y: number) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
const paint = (image: Rgba, x: number, y: number, [r, g, b]: Colour, a = 255) => image.data.set([r, g, b, a], (y * image.width + x) * 4);
const rect = (image: Rgba, x0: number, y0: number, w: number, h: number, colour: Colour) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) paint(image, x, y, colour);
};
const mix = (a: Colour, b: Colour, t: number): Colour => [0, 1, 2].map((c) => Math.round(a[c]! * t + b[c]! * (1 - t))) as unknown as Colour;

/** A red figure on a blue key, with a half-blended edge pixel and an enclosed violet patch. */
function keyedFigure() {
  const image = blank(20, 20);
  fill(image, BLUE);
  rect(image, 5, 5, 10, 10, RED);
  rect(image, 9, 9, 2, 2, VIOLET);
  paint(image, 4, 10, mix(RED, BLUE, 0.5));
  return image;
}

describe('chroma key', () => {
  it('reads the key colour from the border', () => {
    expect(keyColour(keyedFigure())).toEqual(BLUE);
  });

  it('clears the key, un-mixes blended edges, and keeps interior colours near the key solid', () => {
    const out = chromaKey(keyedFigure(), BLUE);
    expect(pixel(out, 0, 0)[3]).toBe(0);
    expect(pixel(out, 7, 7)).toEqual([...RED, 255]);
    const [r, g, b, a] = pixel(out, 4, 10) as [number, number, number, number];
    expect(a).toBeGreaterThan(64);
    expect(a).toBeLessThan(220);
    // The blend's blue is removed: the edge pixel reads as red, not purple.
    expect(Math.abs(r - RED[0]) + Math.abs(g - RED[1]) + Math.abs(b - RED[2])).toBeLessThan(40);
    expect(pixel(out, 9, 9)).toEqual([...VIOLET, 255]);
  });

  it('clears enclosed gaps of key colour, not just the outside', () => {
    const image = keyedFigure();
    rect(image, 11, 6, 2, 2, BLUE);
    expect(pixel(chromaKey(image, BLUE), 11, 6)[3]).toBe(0);
  });
});

describe('generator alpha', () => {
  it('snaps a near-solid matte to solid and near-clear to clear', () => {
    const image = blank(3, 1);
    paint(image, 0, 0, RED, 252);
    paint(image, 1, 0, RED, 128);
    paint(image, 2, 0, RED, 6);
    const out = normaliseAlpha(image);
    expect([pixel(out, 0, 0)[3], pixel(out, 1, 0)[3], pixel(out, 2, 0)]).toEqual([255, 128, [0, 0, 0, 0]]);
  });
});

describe('trim', () => {
  it('crops to the figure plus padding', () => {
    const image = blank(30, 30);
    rect(image, 10, 12, 5, 8, RED);
    expect(opaqueBounds(image)).toEqual({ x: 10, y: 12, width: 5, height: 8 });
    const out = trim(image, 2);
    expect([out.width, out.height]).toEqual([9, 12]);
    expect(pixel(out, 2, 2)).toEqual([...RED, 255]);
    expect(pixel(out, 1, 1)[3]).toBe(0);
  });
});

describe('pixelate', () => {
  it('recovers native pixel art from a 4× upscale with hard edges', () => {
    const native = blank(6, 8);
    rect(native, 1, 1, 4, 6, RED);
    rect(native, 2, 3, 2, 2, VIOLET);
    const out = pixelate(scaleNearest(native, 24, 32), 8);
    expect([out.width, out.height]).toEqual([6, 8]);
    expect(out.data).toEqual(native.data);
  });

  it('never bleeds the colour of transparent pixels into the edge', () => {
    const image = blank(2, 1);
    paint(image, 0, 0, [0, 255, 0], 0);
    paint(image, 1, 0, RED);
    expect(pixel(scaleArea(image, 1, 1), 0, 0)).toEqual([...RED, 128]);
  });
});

describe('cutout', () => {
  it('keys, trims and pixelates a keyed image in one pass', () => {
    const out = cutout(scaleNearest(keyedFigure(), 80, 80), { pixelHeight: 10 });
    expect(out.height).toBe(10);
    expect(pixel(out, 0, 0)[3]).toBe(0);
    expect(pixel(out, 5, 5)[3]).toBe(255);
    for (let i = 3; i < out.data.length; i += 4) expect([0, 255]).toContain(out.data[i]);
  });
});
