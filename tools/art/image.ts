import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/** Straight (not premultiplied) RGBA, row-major. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export function blank(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function readPng(path: string): Rgba {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function writePng(path: string, image: Rgba): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  writeFileSync(path, PNG.sync.write(png));
}

export function crop(image: Rgba, x: number, y: number, width: number, height: number): Rgba {
  const out = blank(width, height);
  for (let row = 0; row < height; row++) {
    const sy = y + row;
    if (sy < 0 || sy >= image.height) continue;
    for (let col = 0; col < width; col++) {
      const sx = x + col;
      if (sx < 0 || sx >= image.width) continue;
      out.data.set(image.data.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), (row * width + col) * 4);
    }
  }
  return out;
}

/** Nearest-neighbour resize, used for previews of pixel art. */
export function scaleNearest(image: Rgba, width: number, height: number): Rgba {
  const out = blank(width, height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      out.data.set(image.data.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  return out;
}

/** Area-average resize in premultiplied alpha, so transparent pixels never bleed colour into edges. */
export function scaleArea(image: Rgba, width: number, height: number): Rgba {
  const out = blank(width, height);
  const fx = image.width / width;
  const fy = image.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * fy;
    const y1 = y0 + fy;
    for (let x = 0; x < width; x++) {
      const x0 = x * fx;
      const x1 = x0 + fx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const w = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const i = (sy * image.width + sx) * 4;
          const alpha = (image.data[i + 3] ?? 0) / 255;
          r += (image.data[i] ?? 0) * alpha * w;
          g += (image.data[i + 1] ?? 0) * alpha * w;
          b += (image.data[i + 2] ?? 0) * alpha * w;
          a += alpha * w;
          area += w;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
      out.data[o + 3] = Math.round((a / area) * 255);
    }
  }
  return out;
}

/** Draws `top` over `base` at (x, y) with straight-alpha "over" compositing. */
export function composite(base: Rgba, top: Rgba, x: number, y: number): void {
  for (let row = 0; row < top.height; row++) {
    const by = y + row;
    if (by < 0 || by >= base.height) continue;
    for (let col = 0; col < top.width; col++) {
      const bx = x + col;
      if (bx < 0 || bx >= base.width) continue;
      const t = (row * top.width + col) * 4;
      const b = (by * base.width + bx) * 4;
      const ta = (top.data[t + 3] ?? 0) / 255;
      if (ta === 0) continue;
      const ba = (base.data[b + 3] ?? 0) / 255;
      const oa = ta + ba * (1 - ta);
      for (let c = 0; c < 3; c++) {
        base.data[b + c] = Math.round(((top.data[t + c] ?? 0) * ta + (base.data[b + c] ?? 0) * ba * (1 - ta)) / oa);
      }
      base.data[b + 3] = Math.round(oa * 255);
    }
  }
}

export function fill(image: Rgba, [r, g, b]: readonly [number, number, number]): void {
  for (let i = 0; i < image.data.length; i += 4) image.data.set([r, g, b, 255], i);
}
