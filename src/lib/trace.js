// Raster → vector: marching-squares contour tracing, Ramer–Douglas–Peucker
// simplification and corner-aware Bézier fitting. Shared by the pattern
// vectorizer, the sketch cleaner and the 3D typography demo.

// Edge ids inside one cell: 0 = top, 1 = right, 2 = bottom, 3 = left.
const SEGMENTS = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  null, // saddle
  [[0, 2]],
  [[0, 3]],
  [[0, 3]],
  [[0, 2]],
  null, // saddle
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  [],
];

/**
 * Trace iso-contours of a scalar field.
 * The field is padded with a value below `iso`, so every contour is closed;
 * shapes touching the border are closed exactly along the border, which keeps
 * periodic fields seamless when tiled.
 * Returns an array of closed loops, each an array of [x, y] in field coordinates.
 */
export function traceContours(field, w, h, iso) {
  const W = w + 2;
  const H = h + 2;
  const low = iso - 1e6;
  const val = new Float32Array(W * H).fill(low);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) val[(y + 1) * W + (x + 1)] = field[y * w + x];
  }

  const nKeys = W * H * 2;
  const adjA = new Int32Array(nKeys).fill(-1);
  const adjB = new Int32Array(nKeys).fill(-1);
  const px = new Float32Array(nKeys);
  const py = new Float32Array(nKeys);

  const link = (a, b) => {
    if (adjA[a] === -1) adjA[a] = b;
    else adjB[a] = b;
    if (adjA[b] === -1) adjA[b] = a;
    else adjB[b] = a;
  };

  const interp = (a, b) => {
    const d = b - a;
    return d === 0 ? 0.5 : (iso - a) / d;
  };

  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const tl = val[j * W + i];
      const tr = val[j * W + i + 1];
      const br = val[(j + 1) * W + i + 1];
      const bl = val[(j + 1) * W + i];
      const c = (tl >= iso ? 8 : 0) | (tr >= iso ? 4 : 0) | (br >= iso ? 2 : 0) | (bl >= iso ? 1 : 0);
      if (c === 0 || c === 15) continue;

      const keyOf = (e) => {
        switch (e) {
          case 0: { const k = (j * W + i) * 2; px[k] = i + interp(tl, tr); py[k] = j; return k; }
          case 1: { const k = (j * W + i + 1) * 2 + 1; px[k] = i + 1; py[k] = j + interp(tr, br); return k; }
          case 2: { const k = ((j + 1) * W + i) * 2; px[k] = i + interp(bl, br); py[k] = j + 1; return k; }
          default: { const k = (j * W + i) * 2 + 1; px[k] = i; py[k] = j + interp(tl, bl); return k; }
        }
      };

      let segs = SEGMENTS[c];
      if (segs === null) {
        const centerInside = (tl + tr + br + bl) / 4 >= iso;
        if (c === 5) segs = centerInside ? [[0, 3], [2, 1]] : [[0, 1], [3, 2]];
        else segs = centerInside ? [[0, 1], [3, 2]] : [[0, 3], [2, 1]];
      }
      for (const [e0, e1] of segs) link(keyOf(e0), keyOf(e1));
    }
  }

  const visited = new Uint8Array(nKeys);
  const loops = [];
  for (let k = 0; k < nKeys; k++) {
    if (adjA[k] === -1 || visited[k]) continue;
    const loop = [];
    let prev = -1;
    let cur = k;
    while (cur !== -1 && !visited[cur]) {
      visited[cur] = 1;
      loop.push([px[cur] - 1, py[cur] - 1]);
      const next = adjA[cur] !== prev ? adjA[cur] : adjB[cur];
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker for an open polyline. */
export function simplifyOpen(points, eps) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** RDP for a closed loop: split at the point farthest from the first one. */
export function simplifyClosed(loop, eps) {
  if (loop.length < 4) return loop.slice();
  let far = 0;
  let maxD = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > maxD) {
      maxD = d;
      far = i;
    }
  }
  const a = simplifyOpen(loop.slice(0, far + 1), eps);
  const b = simplifyOpen(loop.slice(far).concat([loop[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

export function signedArea(loop) {
  let a = 0;
  for (let i = 0, n = loop.length; i < n; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/**
 * Fit Illustrator-style anchors to a closed polygon. Points whose turning angle
 * exceeds `cornerDeg` become corner points (no handles); the rest become smooth
 * points with Catmull-Rom derived handles.
 * Returns [{x, y, inX, inY, outX, outY, corner}].
 */
export function fitBezier(points, { cornerDeg = 55, tension = 1 } = {}) {
  const n = points.length;
  const cornerCos = Math.cos((cornerDeg * Math.PI) / 180);
  const anchors = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const bx = p2[0] - p1[0];
    const by = p2[1] - p1[1];
    const la = Math.hypot(ax, ay) || 1;
    const lb = Math.hypot(bx, by) || 1;
    const cos = (ax * bx + ay * by) / (la * lb);
    const corner = cos < cornerCos;
    let inX = p1[0];
    let inY = p1[1];
    let outX = p1[0];
    let outY = p1[1];
    if (!corner) {
      // Tangent from neighbours, handle length proportional to each adjacent segment.
      const tx = p2[0] - p0[0];
      const ty = p2[1] - p0[1];
      const tl = Math.hypot(tx, ty) || 1;
      const k = tension / 3;
      inX = p1[0] - (tx / tl) * la * k;
      inY = p1[1] - (ty / tl) * la * k;
      outX = p1[0] + (tx / tl) * lb * k;
      outY = p1[1] + (ty / tl) * lb * k;
    }
    anchors.push({ x: p1[0], y: p1[1], inX, inY, outX, outY, corner });
  }
  return anchors;
}

const r = (v) => Math.round(v * 100) / 100;

/** Anchors → SVG path data (closed). */
export function anchorsToPath(anchors, scale = 1, ox = 0, oy = 0) {
  if (!anchors.length) return '';
  const s = (v, o) => r(v * scale + o);
  let d = `M${s(anchors[0].x, ox)} ${s(anchors[0].y, oy)}`;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    if (a.corner && b.corner) d += `L${s(b.x, ox)} ${s(b.y, oy)}`;
    else d += `C${s(a.outX, ox)} ${s(a.outY, oy)} ${s(b.inX, ox)} ${s(b.inY, oy)} ${s(b.x, ox)} ${s(b.y, oy)}`;
  }
  return d + 'Z';
}

/** Polygon → SVG path data (closed, straight segments). */
export function loopToPath(loop, scale = 1) {
  let d = '';
  for (let i = 0; i < loop.length; i++) d += `${i ? 'L' : 'M'}${r(loop[i][0] * scale)} ${r(loop[i][1] * scale)}`;
  return d + 'Z';
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Group loops into outer shapes with holes using containment depth
 * (even depth = solid, odd depth = hole of its smallest container).
 * Returns [{ outer: loop, holes: [loop] }].
 */
export function nestLoops(loops) {
  const items = loops.map((loop) => ({ loop, area: Math.abs(signedArea(loop)), depth: 0, parent: -1 }));
  for (let i = 0; i < items.length; i++) {
    const [x, y] = items[i].loop[0];
    let best = -1;
    for (let j = 0; j < items.length; j++) {
      if (i === j || items[j].area <= items[i].area) continue;
      if (pointInPolygon(x, y, items[j].loop)) {
        items[i].depth++;
        if (best === -1 || items[j].area < items[best].area) best = j;
      }
    }
    items[i].parent = best;
  }
  const shapes = new Map();
  items.forEach((it, i) => {
    if (it.depth % 2 === 0) shapes.set(i, { outer: it.loop, holes: [] });
  });
  items.forEach((it) => {
    if (it.depth % 2 === 1 && shapes.has(it.parent)) shapes.get(it.parent).holes.push(it.loop);
  });
  return [...shapes.values()];
}

/** Separable box blur, in place-safe (returns new array). */
export function boxBlur(src, w, h, radius) {
  if (radius < 1) return Float32Array.from(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / size;
      const add = Math.min(w - 1, x + radius + 1);
      const rem = Math.max(0, x - radius);
      acc += src[y * w + add] - src[y * w + rem];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      const add = Math.min(h - 1, y + radius + 1);
      const rem = Math.max(0, y - radius);
      acc += tmp[add * w + x] - tmp[rem * w + x];
    }
  }
  return out;
}

/** Same as boxBlur but wraps around the edges (for seamless tiles). */
export function boxBlurWrap(src, w, h, radius) {
  if (radius < 1) return Float32Array.from(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = radius * 2 + 1;
  const wx = (x) => ((x % w) + w) % w;
  const wy = (y) => ((y % h) + h) % h;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * w + wx(x)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / size;
      acc += src[y * w + wx(x + radius + 1)] - src[y * w + wx(x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[wy(y) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[wy(y + radius + 1) * w + x] - tmp[wy(y - radius) * w + x];
    }
  }
  return out;
}
