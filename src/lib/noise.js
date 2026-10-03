// Seeded PRNG + Perlin noise (2D periodic and 3D) used by every demo.

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export function createNoise(seed = 1) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function grad2(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** 2D Perlin noise that repeats every `px` x `py` lattice cells. Range ~[-1, 1]. */
  function noise2(x, y, px = 256, py = 256) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;
    const x0 = ((X % px) + px) % px;
    const y0 = ((Y % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const h = (i, j) => perm[perm[i & 255] + (j & 255)];
    const u = fade(xf);
    const v = fade(yf);
    const n00 = grad2(h(x0, y0), xf, yf);
    const n10 = grad2(h(x1, y0), xf - 1, yf);
    const n01 = grad2(h(x0, y1), xf, yf - 1);
    const n11 = grad2(h(x1, y1), xf - 1, yf - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 0.5;
  }

  /** Classic improved Perlin noise in 3D. Range ~[-1, 1]. */
  function noise3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad3(perm[AA], x, y, z), grad3(perm[BA], x - 1, y, z), u),
        lerp(grad3(perm[AB], x, y - 1, z), grad3(perm[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad3(perm[AA + 1], x, y, z - 1), grad3(perm[BA + 1], x - 1, y, z - 1), u),
        lerp(grad3(perm[AB + 1], x, y - 1, z - 1), grad3(perm[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  /** Periodic fractal noise over the unit square: fbm2(u, v) with u, v in [0, 1). */
  function fbm2(u, v, baseFreq = 4, octaves = 4, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = baseFreq;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(u * f, v * f, f, f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  }

  function fbm3(x, y, z, octaves = 4, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise3(x * f, y * f, z * f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  }

  return { noise2, noise3, fbm2, fbm3, rand };
}

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export { lerp };
