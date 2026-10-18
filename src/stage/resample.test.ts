import { describe, expect, it } from 'vitest';
import { downscale, sharpen, type Pixels } from './resample.ts';

function image(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}
const at = (p: Pixels, x: number, y: number) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

describe('sprite resampling', () => {
  it('averages areas and never bleeds the colour of transparent pixels into edges', () => {
    // Left half solid red, right half transparent green.
    const src = image(4, 2, (x) => (x < 2 ? [200, 20, 20, 255] : [0, 255, 0, 0]));
    const out = downscale(src, 2, 1);
    expect(at(out, 0, 0)).toEqual([200, 20, 20, 255]);
    expect(at(out, 1, 0)[3]).toBe(0);
    const edge = downscale(src, 1, 1);
    expect(at(edge, 0, 0)).toEqual([200, 20, 20, 128]);
  });

  it('leaves flat areas alone and steepens edges when sharpening', () => {
    const src = image(6, 1, (x) => (x < 3 ? [60, 60, 60, 255] : [180, 180, 180, 255]));
    const out = sharpen(src, 0.8);
    expect(at(out, 0, 0)).toEqual([60, 60, 60, 255]);
    expect(at(out, 5, 0)).toEqual([180, 180, 180, 255]);
    expect(at(out, 2, 0)[0]).toBeLessThan(60);
    expect(at(out, 3, 0)[0]).toBeGreaterThan(180);
  });

  it('does not darken a sprite edge against transparency', () => {
    const src = image(4, 1, (x) => (x < 2 ? [240, 200, 180, 255] : [0, 0, 0, 0]));
    const [r, g, b] = at(sharpen(src, 0.8), 1, 0);
    expect([r, g, b]).toEqual([240, 200, 180]);
  });
});
