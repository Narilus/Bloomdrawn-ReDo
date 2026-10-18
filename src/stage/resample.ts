/** Straight-alpha RGBA, the layout of canvas ImageData. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Area-average downscale in premultiplied alpha, so transparent pixels never darken the edges. */
export function downscale(src: Pixels, width: number, height: number): Pixels {
  const out = new Uint8ClampedArray(width * height * 4);
  const fx = src.width / width;
  const fy = src.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * fy;
    const y1 = y0 + fy;
    for (let x = 0; x < width; x++) {
      const x0 = x * fx;
      const x1 = x0 + fx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let sy = Math.floor(y0); sy < Math.min(src.height, Math.ceil(y1)); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.min(src.width, Math.ceil(x1)); sx++) {
          const w = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const i = (sy * src.width + sx) * 4;
          const alpha = ((src.data[i + 3] ?? 0) / 255) * w;
          r += (src.data[i] ?? 0) * alpha;
          g += (src.data[i + 1] ?? 0) * alpha;
          b += (src.data[i + 2] ?? 0) * alpha;
          a += alpha;
          area += w;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = (a / area) * 255;
    }
  }
  return { width, height, data: out };
}

/**
 * Unsharp mask with a 3×3 binomial blur. Downscaling art whose detail is finer than the screen
 * softens it; a light pass restores the edges. The colour blur is weighted by alpha, so at the
 * sprite's outline only the sprite's own colours count and no light or dark halo appears.
 */
export function sharpen(src: Pixels, amount: number): Pixels {
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  const KERNEL = [1, 2, 1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const alpha = data[o + 3] ?? 0;
      let r = 0, g = 0, b = 0, a = 0, weights = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const sy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const sx = Math.min(width - 1, Math.max(0, x + dx));
          const i = (sy * width + sx) * 4;
          const k = (KERNEL[dy + 1] ?? 0) * (KERNEL[dx + 1] ?? 0);
          const w = k * (data[i + 3] ?? 0);
          r += (data[i] ?? 0) * w;
          g += (data[i + 1] ?? 0) * w;
          b += (data[i + 2] ?? 0) * w;
          a += w;
          weights += k;
        }
      }
      out[o + 3] = alpha + amount * (alpha - a / 255 / weights);
      if (a === 0) continue;
      out[o] = (data[o] ?? 0) + amount * ((data[o] ?? 0) - r / a);
      out[o + 1] = (data[o + 1] ?? 0) + amount * ((data[o + 1] ?? 0) - g / a);
      out[o + 2] = (data[o + 2] ?? 0) + amount * ((data[o + 2] ?? 0) - b / a);
    }
  }
  return { width, height, data: out };
}
