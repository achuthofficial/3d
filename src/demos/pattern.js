// Demo 02 — Text prompt → generated raster → Image Trace (vector) → brand recolour → 3D texture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createStage } from '../lib/stage.js';
import { mountTemplate, setStep, wait, debounce, downloadText, downloadDataUrl, escapeHtml, formatBytes } from '../lib/dom.js';
import { createNoise, hashString, clamp } from '../lib/noise.js';
import { traceContours, simplifyClosed, fitBezier, anchorsToPath, signedArea, boxBlurWrap } from '../lib/trace.js';
import { mixHex, hexToRgb, luminance, hslToHex } from '../lib/color.js';

const N = 256;

const GENERATORS = [
  { id: 'circuit', label: 'Circuit board', words: ['circuit', 'cyber', 'cyberpunk', 'tech', 'pcb', 'electronic', 'digital', 'chip', 'matrix', 'motherboard', 'robot'] },
  { id: 'topo', label: 'Topographic flow', words: ['topographic', 'topo', 'contour', 'map', 'flow', 'marble', 'liquid', 'smoke', 'fluid', 'swirl', 'psychedelic', 'terrain'] },
  { id: 'waves', label: 'Warped stripes', words: ['wave', 'waves', 'stripe', 'stripes', 'retro', 'zebra', 'ripple', 'sound', 'groovy', 'seventies'] },
  { id: 'truchet', label: 'Truchet arcs', words: ['truchet', 'maze', 'deco', 'arc', 'arcs', 'loop', 'labyrinth', 'celtic', 'knot', 'pipes'] },
  { id: 'tri', label: 'Geometric tiles', words: ['geometric', 'triangle', 'triangles', 'tile', 'tiles', 'mosaic', 'bauhaus', 'polygon', 'low', 'poly', 'crystal'] },
  { id: 'terrazzo', label: 'Terrazzo chips', words: ['terrazzo', 'stone', 'speckle', 'confetti', 'granite', 'memphis', 'sprinkle', 'sprinkles', 'chips'] },
  { id: 'camo', label: 'Organic camo', words: ['camo', 'camouflage', 'military', 'jungle', 'army', 'organic', 'blob', 'blobs', 'lava', 'cow', 'leopard', 'animal'] },
  { id: 'floral', label: 'Floral repeat', words: ['floral', 'flower', 'flowers', 'botanical', 'blossom', 'garden', 'petal', 'petals', 'rose', 'sakura', 'daisy', 'spring'] },
];

const RAMPS = [
  { words: ['cyber', 'cyberpunk', 'neon', 'synth', 'night', 'electric'], ramp: ['#050816', '#3a0ca3', '#f72585', '#7df9ff'] },
  { words: ['gold', 'golden', 'luxury', 'deco', 'royal'], ramp: ['#140d05', '#5c3d0e', '#c99a2e', '#fff1c1'] },
  { words: ['floral', 'flower', 'pink', 'rose', 'sakura', 'blossom'], ramp: ['#1a0b14', '#7a1f47', '#e46a9e', '#ffe3ef'] },
  { words: ['forest', 'jungle', 'camo', 'military', 'army', 'botanical', 'leaf', 'moss'], ramp: ['#0d1408', '#2f4a1e', '#7a9a4a', '#dfe8b0'] },
  { words: ['ocean', 'sea', 'wave', 'waves', 'water', 'ice', 'blue'], ramp: ['#04151f', '#0b4f6c', '#20a4f3', '#e0f7ff'] },
  { words: ['lava', 'fire', 'sunset', 'retro', 'seventies', 'groovy'], ramp: ['#1a0500', '#8a1c00', '#ff6b00', '#ffe29a'] },
];

const PALETTES = {
  'Midnight Circuit': ['#0B0F2B', '#1F2A6B', '#00C2A8', '#7CF5E4', '#F2FFFC'],
  'Sunset Pop': ['#2B0F2E', '#8E2C5C', '#F05D5E', '#FFB563', '#FFF1D6'],
  'Forest Craft': ['#14211A', '#2F4A35', '#6E8B3D', '#C9B97A', '#F4EED8'],
  'Ember Brand': ['#1A1208', '#5E2A0C', '#E8590C', '#FFB27A', '#FFF3E8'],
  'Mono Ink': ['#111111', '#3A3A3A', '#7A7A7A', '#C4C4C4', '#F5F5F5'],
};

const ASSETS = { mug: 'Mug', sphere: 'Sphere', knot: 'Torus knot', deck: 'Skate deck' };
const PROMPTS = ['seamless cyberpunk circuit board', 'topographic marble flow', 'art deco truchet arcs in gold', 'pink botanical flowers', 'jungle camo blobs', 'memphis terrazzo confetti'];

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function pickGenerator(prompt) {
  const toks = prompt.toLowerCase().match(/[a-z]+/g) || [];
  let best = null;
  let bestScore = 0;
  for (const g of GENERATORS) {
    const s = toks.filter((t) => g.words.includes(t)).length;
    if (s > bestScore) {
      best = g;
      bestScore = s;
    }
  }
  return best || GENERATORS[hashString(prompt) % GENERATORS.length];
}

function pickRamp(prompt) {
  const toks = prompt.toLowerCase().match(/[a-z]+/g) || [];
  for (const r of RAMPS) if (toks.some((t) => r.words.includes(t))) return r.ramp;
  const hue = hashString(prompt) % 360;
  return [hslToHex(hue, 50, 8), hslToHex(hue, 55, 30), hslToHex(hue + 30, 70, 58), hslToHex(hue + 50, 80, 90)];
}

function wrapDraw(ctx, fn) {
  for (const dx of [-N, 0, N]) {
    for (const dy of [-N, 0, N]) {
      ctx.save();
      ctx.translate(dx, dy);
      fn(ctx);
      ctx.restore();
    }
  }
}

function canvasField(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, N, N);
  draw(ctx);
  const d = ctx.getImageData(0, 0, N, N).data;
  const f = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) f[i] = d[i * 4] / 255;
  return f;
}

function generateField(gen, seed) {
  const nz = createNoise(seed);
  const rand = nz.rand;
  const f = new Float32Array(N * N);
  const each = (fn) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f[y * N + x] = fn(x / N, y / N);
    return f;
  };
  switch (gen) {
    case 'topo':
      return each((u, v) => {
        const wx = nz.fbm2(u, v, 2, 3) * 0.35;
        const wy = nz.fbm2(u + 0.37, v + 0.71, 2, 3) * 0.35;
        return 0.5 + 0.9 * nz.fbm2(((u + wx) % 1 + 1) % 1, ((v + wy) % 1 + 1) % 1, 3, 4);
      });
    case 'waves':
      return each((u, v) => 0.5 + 0.5 * Math.sin(2 * Math.PI * (6 * u + 2 * v + 0.9 * nz.fbm2(u, v, 2, 3))));
    case 'camo':
      return each((u, v) => 0.5 + 1.1 * nz.fbm2(u, v, 3, 4, 0.55));
    case 'circuit':
      return canvasField((ctx) => {
        const g = 16;
        const paths = [];
        for (let k = 0; k < 26; k++) {
          let x = Math.floor(rand() * 16) * g;
          let y = Math.floor(rand() * 16) * g;
          const pts = [[x, y]];
          let dir = Math.floor(rand() * 4) * 2;
          const steps = 3 + Math.floor(rand() * 8);
          for (let s = 0; s < steps; s++) {
            if (rand() < 0.3) dir = (dir + (rand() < 0.5 ? 1 : 7)) % 8;
            x += DIRS[dir][0] * g;
            y += DIRS[dir][1] * g;
            pts.push([x, y]);
          }
          paths.push(pts);
        }
        const chips = Array.from({ length: 3 }, () => [Math.floor(rand() * 14) * g, Math.floor(rand() * 14) * g, g * (2 + Math.floor(rand() * 2)), g * 2]);
        wrapDraw(ctx, (c) => {
          c.strokeStyle = '#fff';
          c.lineWidth = 3.4;
          c.lineJoin = 'round';
          c.lineCap = 'round';
          for (const pts of paths) {
            c.beginPath();
            pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
            c.stroke();
          }
          for (const pts of paths) {
            for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
              c.fillStyle = '#fff';
              c.beginPath();
              c.arc(x, y, 6, 0, Math.PI * 2);
              c.fill();
              c.fillStyle = '#000';
              c.beginPath();
              c.arc(x, y, 2.4, 0, Math.PI * 2);
              c.fill();
            }
          }
          for (const [x, y, w, h] of chips) {
            c.fillStyle = '#9a9a9a';
            c.fillRect(x, y, w, h);
            c.fillStyle = '#fff';
            for (let px = x + 4; px < x + w - 2; px += 6) {
              c.fillRect(px, y - 5, 2.4, 5);
              c.fillRect(px, y + h, 2.4, 5);
            }
          }
        });
      });
    case 'truchet':
      return canvasField((ctx) => {
        const s = 32;
        const tiles = [];
        for (let y = 0; y < N / s; y++) for (let x = 0; x < N / s; x++) tiles.push([x * s, y * s, rand() < 0.5]);
        wrapDraw(ctx, (c) => {
          c.strokeStyle = '#fff';
          c.lineWidth = 9;
          for (const [x, y, flip] of tiles) {
            c.beginPath();
            if (flip) {
              c.arc(x, y, s / 2, 0, Math.PI / 2);
              c.moveTo(x + s, y + s / 2);
              c.arc(x + s, y + s, s / 2, Math.PI, Math.PI * 1.5);
            } else {
              c.arc(x + s, y, s / 2, Math.PI / 2, Math.PI);
              c.moveTo(x + s / 2, y + s);
              c.arc(x, y + s, s / 2, -Math.PI / 2, 0);
            }
            c.stroke();
          }
        });
      });
    case 'tri':
      return canvasField((ctx) => {
        const s = 32;
        const shades = ['#111', '#555', '#999', '#ddd'];
        for (let y = 0; y < N; y += s) {
          for (let x = 0; x < N; x += s) {
            const diag = rand() < 0.5;
            const a = shades[Math.floor(rand() * 4)];
            const b = shades[Math.floor(rand() * 4)];
            ctx.fillStyle = a;
            ctx.beginPath();
            if (diag) {
              ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s);
            } else {
              ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s);
            }
            ctx.fill();
            ctx.fillStyle = b;
            ctx.beginPath();
            if (diag) {
              ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s);
            } else {
              ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s);
            }
            ctx.fill();
          }
        }
      });
    case 'terrazzo':
      return canvasField((ctx) => {
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(0, 0, N, N);
        const chips = Array.from({ length: 70 }, () => {
          const cx = rand() * N;
          const cy = rand() * N;
          const r = 4 + rand() ** 2 * 18;
          const k = 5 + Math.floor(rand() * 4);
          const pts = Array.from({ length: k }, (_, i) => {
            const a = (i / k) * Math.PI * 2 + rand() * 0.6;
            const rr = r * (0.6 + rand() * 0.5);
            return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
          });
          return { pts, shade: ['#141414', '#c8c8c8', '#ffffff', '#262626'][Math.floor(rand() * 4)] };
        });
        wrapDraw(ctx, (c) => {
          for (const ch of chips) {
            c.fillStyle = ch.shade;
            c.beginPath();
            ch.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
            c.fill();
          }
        });
      });
    case 'floral':
    default:
      return canvasField((ctx) => {
        const flowers = Array.from({ length: 14 }, () => ({ x: rand() * N, y: rand() * N, r: 14 + rand() * 16, rot: rand() * Math.PI, k: 5 + Math.floor(rand() * 2) }));
        const leaves = Array.from({ length: 22 }, () => ({ x: rand() * N, y: rand() * N, r: 8 + rand() * 8, rot: rand() * Math.PI }));
        wrapDraw(ctx, (c) => {
          for (const l of leaves) {
            c.save();
            c.translate(l.x, l.y);
            c.rotate(l.rot);
            c.fillStyle = '#555';
            c.beginPath();
            c.ellipse(0, 0, l.r * 1.6, l.r * 0.55, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
          }
          for (const fl of flowers) {
            c.save();
            c.translate(fl.x, fl.y);
            c.rotate(fl.rot);
            c.fillStyle = '#e8e8e8';
            c.beginPath();
            for (let i = 0; i <= 120; i++) {
              const a = (i / 120) * Math.PI * 2;
              const rr = fl.r * (0.45 + 0.55 * Math.abs(Math.cos((fl.k / 2) * a)));
              c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            c.fill();
            c.fillStyle = '#9a9a9a';
            c.beginPath();
            c.arc(0, 0, fl.r * 0.28, 0, Math.PI * 2);
            c.fill();
            c.restore();
          }
        });
      });
  }
}

function rampColor(ramp, t) {
  t = clamp(t) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(t));
  return mixHex(ramp[i], ramp[i + 1], t - i);
}

/** Paint the field as a colourful "AI" raster and return its blurred luminance for tracing. */
function rasterize(field, ramp, canvas, seed) {
  const nz = createNoise(seed + 7);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const lut = Array.from({ length: 256 }, (_, i) => hexToRgb(rampColor(ramp, i / 255)));
  const lum = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const shade = 0.06 * nz.fbm2(x / N, y / N, 2, 2);
      const grain = (nz.rand() - 0.5) * 0.05;
      const v = clamp(field[i] + shade + grain);
      const [r, g, b] = lut[Math.round(v * 255)];
      img.data.set([r, g, b, 255], i * 4);
      lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return boxBlurWrap(lum, N, N, 2);
}

/** Image Trace: quantile thresholds → contours → simplified Bézier paths per colour band. */
function vectorize(lum, levels, eps) {
  const sorted = Float32Array.from(lum).sort();
  const thresholds = [];
  for (let k = 1; k < levels; k++) thresholds.push(sorted[Math.floor((k / levels) * (sorted.length - 1))]);
  // Periodic (N+1)×(N+1) grid so contours meet across tile edges.
  const M = N + 1;
  const grid = new Float32Array(M * M);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) grid[y * M + x] = lum[(y % N) * N + (x % N)];
  let anchors = 0;
  let paths = 0;
  const bands = thresholds.map((t) => {
    const loops = traceContours(grid, M, M, t).filter((l) => Math.abs(signedArea(l)) > 3);
    let d = '';
    for (const loop of loops) {
      const simple = simplifyClosed(loop, eps);
      if (simple.length < 3) continue;
      const a = fitBezier(simple, { cornerDeg: 62 });
      anchors += a.length;
      paths++;
      d += anchorsToPath(a);
    }
    return d;
  });
  return { bands, anchors, paths };
}

function bandColors(palette, levels) {
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));
  return Array.from({ length: levels }, (_, k) => rampColor(sorted, levels === 1 ? 0 : k / (levels - 1)));
}

function buildSvg(bands, colors, tiles = 1) {
  const body = `<rect width="${N}" height="${N}" fill="${colors[0]}"/>` + bands.map((d, i) => (d ? `<path d="${d}" fill="${colors[i + 1]}" fill-rule="evenodd"/>` : '')).join('');
  if (tiles === 1) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${N}" height="${N}">${body}</svg>`;
  const S = N * tiles;
  let uses = '';
  for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) uses += `<use href="#t" x="${x * N}" y="${y * N}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><defs><g id="t">${body}</g></defs>${uses}</svg>`;
}

function buildAsset(kind, material, accent) {
  const g = new THREE.Group();
  if (kind === 'mug') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.84, 1.9, 128, 1, true), material);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.79, 1.86, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3, side: THREE.BackSide }));
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.84, 64), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 }));
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -0.95;
    const innerBottom = bottom.clone();
    innerBottom.rotation.x = -Math.PI / 2;
    innerBottom.position.y = -0.9;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.875, 0.028, 16, 128), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.95;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 24, 64, Math.PI), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3 }));
    handle.rotation.z = -Math.PI / 2;
    handle.position.x = 0.86;
    g.add(body, inner, bottom, innerBottom, rim, handle);
    g.userData.repeat = [3, 1];
  } else if (kind === 'sphere') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 128, 96), material));
    g.userData.repeat = [2, 1];
  } else if (kind === 'knot') {
    g.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.85, 0.32, 360, 48), material));
    g.userData.repeat = [10, 1];
  } else {
    const deck = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.08, 0.95, 6, 0.035), material);
    deck.position.y = 0.32;
    const metal = new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
    for (const x of [-1.1, 1.1]) {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.8), metal);
      truck.position.set(x, 0.22, 0);
      g.add(truck);
      for (const z of [-0.4, 0.4]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 32), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.11, z);
        g.add(wheel);
      }
    }
    g.add(deck);
    g.position.y = -0.3;
    g.rotation.x = 0.35;
    g.userData.repeat = [3.6, 1];
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export async function mount(root) {
  const paletteButtons = Object.entries(PALETTES)
    .map(([name, cols], i) => `<button type="button" class="palette${i === 0 ? ' is-on' : ''}" data-name="${name}" title="${name}">${cols.map((c) => `<i style="background:${c}"></i>`).join('')}<span>${name}</span></button>`)
    .join('');
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="viewport" data-ref="stage">
        <div class="viewport-badge" data-ref="status">Type a prompt and generate</div>
        <div class="viewport-hint">Drag to orbit · scroll to zoom</div>
      </div>
      <ol class="steps" data-ref="steps"><li>AI raster</li><li>Image Trace</li><li>Brand recolour</li><li>3D texture</li></ol>
    </div>
    <div class="demo-side">
      <div class="prompt-row">
        <input data-ref="prompt" value="${PROMPTS[0]}" aria-label="Pattern prompt" />
        <button class="btn btn-primary" data-ref="go" type="button">Generate</button>
      </div>
      <div class="chips" data-ref="chips">${PROMPTS.map((p) => `<button class="chip" type="button">${escapeHtml(p)}</button>`).join('')}</div>
      <div class="triptych">
        <figure><canvas data-ref="raster" width="${N}" height="${N}"></canvas><figcaption>1 · Raster <span data-ref="genName"></span></figcaption></figure>
        <figure><div class="svgbox" data-ref="traced"></div><figcaption>2 · Traced vector</figcaption></figure>
        <figure><div class="svgbox" data-ref="recolor"></div><figcaption>3 · Brand · 2×2 tile</figcaption></figure>
      </div>
      <div class="field-grid">
        <label class="field"><span>Colours <output data-ref="levelsOut">4</output></span><input type="range" min="2" max="6" value="4" data-ref="levels" /></label>
        <label class="field"><span>Path fidelity <output data-ref="epsOut">High</output></span><input type="range" min="0" max="100" value="70" data-ref="fidelity" /></label>
        <label class="field"><span>Tiling <output data-ref="repOut">2×</output></span><input type="range" min="1" max="6" value="2" data-ref="repeat" /></label>
        <label class="field"><span>3D asset</span><select data-ref="asset">${Object.entries(ASSETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <div class="label">Brand palette</div>
      <div class="palettes" data-ref="palettes">${paletteButtons}</div>
      <div class="btn-row">
        <button class="btn" data-ref="svg" type="button">Download SVG tile</button>
        <button class="btn" data-ref="png" type="button">Download texture PNG</button>
      </div>
    </div>
    <div class="demo-foot"><div class="stats" data-ref="stats"></div></div>
  </div>`
  );

  const stage = createStage(refs.stage, { camera: [0, 1.2, 5.8], target: [0, 0, 0], background: 0x15171d });
  const { scene } = stage;
  stage.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  stage.controls.autoRotateSpeed = 1.4;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, new THREE.HemisphereLight(0xbfd4ff, 0x1a1a22, 0.5));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.3;
  floor.receiveShadow = true;
  scene.add(floor);

  const texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = 1024;
  const texture = new THREE.CanvasTexture(texCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
  const material = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 });

  const state = { prompt: PROMPTS[0], lum: null, ramp: null, vec: null, palette: 'Midnight Circuit', asset: 'mug', svg: '' };
  let asset = null;

  const epsilon = () => 0.35 + (1 - refs.fidelity.value / 100) * 3.2;

  function updateAsset() {
    if (asset) {
      scene.remove(asset);
      asset.traverse((o) => {
        if (o.isMesh && o.material !== material) o.material.dispose();
        o.geometry?.dispose();
      });
    }
    const accent = bandColors(PALETTES[state.palette], 3)[1];
    asset = buildAsset(refs.asset.value, material, accent);
    scene.add(asset);
    applyRepeat();
  }

  function applyRepeat() {
    const r = +refs.repeat.value;
    const [ux, uy] = asset.userData.repeat;
    texture.repeat.set(Math.round(ux * r), Math.round(uy * r));
    refs.repOut.textContent = `${r}×`;
  }

  function retrace() {
    if (!state.lum) return;
    const levels = +refs.levels.value;
    refs.levelsOut.textContent = levels;
    const eps = epsilon();
    refs.epsOut.textContent = eps < 1 ? 'High' : eps < 2.2 ? 'Medium' : 'Low';
    const t0 = performance.now();
    state.vec = vectorize(state.lum, levels, eps);
    state.traceMs = performance.now() - t0;
    const tracedColors = Array.from({ length: levels }, (_, k) => rampColor(state.ramp, levels === 1 ? 0 : k / (levels - 1)));
    refs.traced.innerHTML = buildSvg(state.vec.bands, tracedColors);
    recolor();
  }

  function recolor() {
    if (!state.vec) return;
    const levels = state.vec.bands.length + 1;
    const colors = bandColors(PALETTES[state.palette], levels);
    state.svg = buildSvg(state.vec.bands, colors);
    refs.recolor.innerHTML = buildSvg(state.vec.bands, colors, 2);
    const ctx = texCanvas.getContext('2d');
    ctx.setTransform(1024 / N, 0, 0, 1024 / N, 0, 0);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, N, N);
    state.vec.bands.forEach((d, i) => {
      if (!d) return;
      ctx.fillStyle = colors[i + 1];
      ctx.fill(new Path2D(d), 'evenodd');
    });
    texture.needsUpdate = true;
    const bytes = new Blob([state.svg]).size;
    refs.stats.innerHTML = `
      <div><b>${(N * N).toLocaleString()}</b><span>raster pixels</span></div>
      <div><b>${state.vec.paths}</b><span>vector paths</span></div>
      <div><b>${state.vec.anchors.toLocaleString()}</b><span>anchor points</span></div>
      <div><b>${formatBytes(bytes)}</b><span>SVG tile</span></div>
      <div><b>${Math.round(state.traceMs)} ms</b><span>trace time</span></div>
      <div><b>Seamless</b><span>periodic edges</span></div>`;
  }

  async function generate(animate = true) {
    state.prompt = refs.prompt.value.trim() || PROMPTS[0];
    const gen = pickGenerator(state.prompt);
    state.ramp = pickRamp(state.prompt);
    const seed = hashString(state.prompt);
    refs.go.disabled = true;
    setStep(refs.steps, 0);
    refs.status.textContent = `Generating raster · ${gen.label}`;
    if (animate) await wait(250);
    const field = generateField(gen.id, seed);
    state.lum = rasterize(field, state.ramp, refs.raster, seed);
    refs.genName.textContent = `· ${gen.label}`;
    if (animate) await wait(350);
    setStep(refs.steps, 1);
    refs.status.textContent = 'Image Trace · contour tracing';
    if (animate) await wait(250);
    retrace();
    if (animate) await wait(350);
    setStep(refs.steps, 2);
    refs.status.textContent = `Recolouring with ${state.palette}`;
    if (animate) await wait(350);
    setStep(refs.steps, 3);
    refs.status.textContent = `Texture applied to ${ASSETS[refs.asset.value]}`;
    if (animate) await wait(200);
    setStep(refs.steps, 4);
    refs.go.disabled = false;
  }

  refs.go.addEventListener('click', () => generate(true));
  refs.prompt.addEventListener('keydown', (e) => e.key === 'Enter' && generate(true));
  refs.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    refs.prompt.value = b.textContent;
    generate(true);
  });
  const retraceSoon = debounce(retrace, 60);
  refs.levels.addEventListener('input', () => {
    refs.levelsOut.textContent = refs.levels.value;
    retraceSoon();
  });
  refs.fidelity.addEventListener('input', retraceSoon);
  refs.repeat.addEventListener('input', applyRepeat);
  refs.asset.addEventListener('change', () => {
    updateAsset();
    refs.status.textContent = `Texture applied to ${ASSETS[refs.asset.value]}`;
  });
  refs.palettes.addEventListener('click', (e) => {
    const b = e.target.closest('.palette');
    if (!b) return;
    refs.palettes.querySelectorAll('.palette').forEach((p) => p.classList.toggle('is-on', p === b));
    state.palette = b.dataset.name;
    recolor();
    updateAsset();
  });
  refs.svg.addEventListener('click', () => downloadText(state.svg, 'pattern-tile.svg', 'image/svg+xml'));
  refs.png.addEventListener('click', () => downloadDataUrl(texCanvas.toDataURL('image/png'), 'pattern-texture.png'));

  updateAsset();
  await generate(false);

  return { activate: () => stage.start(), deactivate: () => stage.stop() };
}
