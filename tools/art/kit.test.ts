import { describe, expect, it } from 'vitest';
import { blank, type Rgba } from './image.ts';
import { splitKit, turn } from './kit.ts';

const rect = (image: Rgba, x0: number, y0: number, w: number, h: number, rgb: [number, number, number]) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) image.data.set([...rgb, 255], (y * image.width + x) * 4);
};
const at = (image: Rgba, x: number, y: number) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

/** A 100×100 kit: an L corner (red) with a petal floating free, a crest (green), a strip along the bottom (blue). */
function kit() {
  const image = blank(100, 100);
  rect(image, 5, 5, 30, 6, [200, 0, 0]);
  rect(image, 5, 5, 6, 30, [200, 0, 0]);
  rect(image, 20, 20, 3, 3, [200, 0, 0]);
  rect(image, 65, 10, 14, 14, [0, 200, 0]);
  rect(image, 5, 80, 90, 8, [0, 0, 200]);
  return image;
}

describe('a frame kit', () => {
  it('cuts the corner, the crest and the strip apart, each trimmed with a 2px margin', () => {
    const { corner, crest, side } = splitKit(kit());
    expect([corner.width, corner.height]).toEqual([34, 34]);
    expect([crest.width, crest.height]).toEqual([18, 18]);
    // The strip, turned to run down the card's side.
    expect([side.width, side.height]).toEqual([12, 94]);
  });

  it('keeps a blob that floats free with its piece, and nothing from the others', () => {
    const { corner, crest } = splitKit(kit());
    expect(at(corner, 2 + 15, 2 + 15)).toEqual([200, 0, 0, 255]);
    expect(corner.data.some((v, i) => i % 4 === 1 && v > 0)).toBe(false);
    expect(crest.data.some((v, i) => i % 4 === 0 && v > 0)).toBe(false);
  });

  it('a petal floating below the middle by the corner\'s long arm stays with the corner, not the strip', () => {
    const image = kit();
    rect(image, 5, 35, 6, 30, [200, 0, 0]);
    rect(image, 14, 60, 3, 3, [200, 0, 0]);
    const { corner, side } = splitKit(image);
    expect(corner.height).toBe(64);
    expect(side.data.some((v, i) => i % 4 === 0 && v > 0)).toBe(false);
  });

  it('a faint glow running between pieces does not join them; each keeps the glow nearest it', () => {
    const image = kit();
    for (let y = 30; y < 80; y++) image.data.set([255, 255, 255, 40], (y * 100 + 8) * 4);
    const { corner, crest, side } = splitKit(image);
    // The glow from y 30 to 79 splits halfway between the corner's arm (to y 34) and the strip (from y 80).
    expect(corner.height).toBe(56 - 5 + 1 + 4);
    expect(side.width).toBe(87 - 57 + 1 + 4);
    expect([crest.width, crest.height]).toEqual([18, 18]);
  });

  it('says so when a piece is missing', () => {
    const image = blank(100, 100);
    rect(image, 5, 5, 30, 6, [200, 0, 0]);
    expect(() => splitKit(image)).toThrow(/no crest/);
  });

  it('a quarter turn clockwise puts the left end at the top', () => {
    const strip = blank(3, 1);
    strip.data.set([9, 0, 0, 255], 0);
    const turned = turn(strip);
    expect([turned.width, turned.height]).toEqual([1, 3]);
    expect(at(turned, 0, 0)).toEqual([9, 0, 0, 255]);
  });
});
