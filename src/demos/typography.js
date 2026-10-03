// Demo 06 — Live text → outlines → prompt-driven depth/displacement map → stylised 3D type.
import * as THREE from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createStage, gradientTexture } from '../lib/stage.js';
import { mountTemplate, setStep, debounce, downloadBlob, downloadDataUrl, escapeHtml, wait } from '../lib/dom.js';
import { createNoise, hashString, smoothstep, clamp } from '../lib/noise.js';
import { traceContours, simplifyClosed, fitBezier, anchorsToPath, nestLoops, boxBlur, signedArea } from '../lib/trace.js';

const STYLES = [
  { id: 'ice', label: 'Melting ice', words: ['ice', 'icy', 'melting', 'melt', 'frozen', 'frost', 'glacier', 'crystal', 'drip', 'dripping', 'water'], inflate: 0.2, drip: 1, jitter: 0.03 },
  { id: 'metal', label: 'Liquid metal', words: ['metal', 'liquid', 'chrome', 'mercury', 'silver', 'steel', 'mirror', 'metallic', 'polished'], inflate: 0.55, drip: 0.3, ripple: 0.05 },
  { id: 'lava', label: 'Molten lava', words: ['lava', 'magma', 'volcano', 'volcanic', 'fire', 'burning', 'ember', 'hot', 'inferno', 'molten'], inflate: 0.16, crack: 0.16, bumps: 0.02 },
  { id: 'candy', label: 'Candy glass', words: ['candy', 'glass', 'gummy', 'jelly', 'sweet', 'sugar', 'lollipop', 'glossy', 'gel', 'bubblegum'], inflate: 0.7 },
  { id: 'stone', label: 'Mossy stone', words: ['stone', 'rock', 'moss', 'mossy', 'ancient', 'ruin', 'granite', 'concrete', 'earth', 'cave'], inflate: 0.12, bumps: 0.045, jitter: 0.012 },
  { id: 'balloon', label: 'Foil balloon', words: ['balloon', 'inflated', 'puffy', 'foil', 'party', 'inflatable', 'pillow', 'bubble'], inflate: 1.15 },
  { id: 'neon', label: 'Neon glow', words: ['neon', 'glow', 'glowing', 'light', 'cyber', 'electric', 'sign', 'tube'], inflate: 0.6 },
];

const COLORS = {
  red: '#ff3b3b', orange: '#ff8a1f', yellow: '#ffd93b', gold: '#ffc94a', golden: '#ffc94a', green: '#3bd16f', emerald: '#2ecc71', teal: '#19c9b5',
  blue: '#3b82ff', cyan: '#3bdcff', purple: '#9b5cff', violet: '#8f5cff', pink: '#ff5fa8', magenta: '#ff3fd1', white: '#f5f5f5', black: '#202020',
  silver: '#d9dde3', copper: '#d9825b', bronze: '#c08a4a', rose: '#ff7aa8', mint: '#7dffcf', ruby: '#e0115f', chocolate: '#5a3622', lime: '#a3ff3b',
};

const FONTS = {
  grotesk: { label: 'Grotesk Bold', css: '700 200px "Space Grotesk", "Arial Black", sans-serif' },
  black: { label: 'Heavy Sans', css: '900 200px "Arial Black", Impact, "Inter", sans-serif' },
  serif: { label: 'Bold Serif', css: '700 200px Georgia, "Times New Roman", serif' },
  mono: { label: 'Mono', css: '700 200px "JetBrains Mono", "Courier New", monospace' },
};

const PROMPTS = ['melting ice', 'liquid metal', 'molten lava', 'pink candy glass', 'ancient mossy stone', 'gold foil balloon', 'cyan neon glow'];

function interpret(prompt) {
  const toks = prompt.toLowerCase().match(/[a-z]+/g) || [];
  let best = null;
  let bestScore = 0;
  for (const s of STYLES) {
    const sc = toks.filter((t) => s.words.includes(t)).length;
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  }
  const style = best || STYLES[hashString(prompt) % STYLES.length];
  const colorWord = toks.find((t) => COLORS[t]);
  return { style, tint: colorWord ? COLORS[colorWord] : null, colorWord, toks, guessed: !best };
}

/** Rasterise text and trace it into nested outline loops (Illustrator's "Create Outlines"). */
function outlineText(text, fontCss) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.font = fontCss;
  const m = ctx.measureText(text);
  const pad = 40;
  const asc = m.actualBoundingBoxAscent || 150;
  const desc = m.actualBoundingBoxDescent || 40;
  const left = m.actualBoundingBoxLeft || 0;
  const w = Math.ceil(Math.max(m.width, (m.actualBoundingBoxRight || m.width) + left) + pad * 2);
  const h = Math.ceil(asc + desc + pad * 2);
  c.width = Math.max(64, w);
  c.height = Math.max(64, h);
  ctx.font = fontCss;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad + left, pad + asc);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const field = new Float32Array(c.width * c.height);
  for (let i = 0; i < field.length; i++) field[i] = data[i * 4 + 3] / 255;
  const loops = traceContours(field, c.width, c.height, 0.5)
    .filter((l) => Math.abs(signedArea(l)) > 6)
    .map((l) => simplifyClosed(l, 0.6))
    .filter((l) => l.length >= 3);
  return { field, width: c.width, height: c.height, loops };
}

export async function mount(root) {
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="viewport" data-ref="stage">
        <div class="viewport-badge" data-ref="status">Building…</div>
        <div class="viewport-hint">Drag to orbit · scroll to zoom</div>
      </div>
      <ol class="steps" data-ref="steps"><li>Live text</li><li>Outlines</li><li>AI depth map</li><li>3D material</li></ol>
    </div>
    <div class="demo-side">
      <div class="field-grid">
        <label class="field"><span>Live text</span><input data-ref="text" value="MELT" maxlength="12" /></label>
        <label class="field"><span>Typeface</span><select data-ref="font">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('')}</select></label>
      </div>
      <div class="prompt-row">
        <input data-ref="prompt" value="${PROMPTS[0]}" aria-label="Style prompt" />
        <button class="btn btn-primary" data-ref="go" type="button">Generate</button>
      </div>
      <div class="chips" data-ref="chips">${PROMPTS.map((p) => `<button class="chip" type="button">${p}</button>`).join('')}</div>
      <div class="duo">
        <figure><div class="svgbox wide" data-ref="outline"></div><figcaption data-ref="outlineCap">Outlines</figcaption></figure>
        <figure><canvas class="depthmap" data-ref="depth"></canvas><figcaption>AI depth / displacement map</figcaption></figure>
      </div>
      <div class="field-grid">
        <label class="field"><span>Displacement <output data-ref="strOut">1.0×</output></span><input type="range" min="0" max="2" step="0.05" value="1" data-ref="strength" /></label>
        <label class="field"><span>Extrude depth <output data-ref="depthOut">0.40</output></span><input type="range" min="0.1" max="1" step="0.05" value="0.4" data-ref="extrude" /></label>
        <label class="field"><span>Mesh detail</span><select data-ref="detail"><option value="0.07">Draft</option><option value="0.045" selected>Standard</option><option value="0.03">High</option></select></label>
        <div class="field"><span>Export</span><div class="btn-row tight"><button class="btn" data-ref="glb" type="button">GLB</button><button class="btn" data-ref="map" type="button">Depth PNG</button></div></div>
      </div>
    </div>
    <div class="demo-foot"><div class="ai-card" data-ref="ai"></div></div>
  </div>`
  );

  const stage = createStage(refs.stage, { camera: [0.8, 0.5, 6.2], target: [0, -0.15, 0], background: 0x101217, minDistance: 2.5, maxDistance: 14 });
  const { scene } = stage;
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 3, bottom: -3 });
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6);
  rim.position.set(4, 2, -4);
  const glow = new THREE.PointLight(0xff5a1a, 0, 8, 1.5);
  glow.position.set(0, -0.4, 1.2);
  scene.add(key, rim, glow);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#15171d', roughness: 0.35, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.45;
  floor.receiveShadow = true;
  scene.add(floor);

  const group = new THREE.Group();
  scene.add(group);
  let outline = null;
  let depthMap = null;
  let building = false;
  let queued = false;

  function clearGroup() {
    group.children.slice().forEach((m) => {
      group.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    });
  }

  function computeDepth(style, k, mapping, nz) {
    // Pillow inflation from a blurred mask, normalised so outlines sit at 0 and stroke centres at 1.
    const { field, width: w, height: h } = outline;
    let b = boxBlur(field, w, h, 7);
    b = boxBlur(b, w, h, 7);
    b = boxBlur(b, w, h, 7);
    let maxV = 0.5001;
    for (let i = 0; i < b.length; i++) maxV = Math.max(maxV, b[i]);
    const inf = new Float32Array(w * h);
    for (let i = 0; i < b.length; i++) inf[i] = smoothstep(0.5, maxV, b[i]);
    // Visualise the full displacement field the 3D step will use.
    const vis = document.createElement('canvas');
    vis.width = w;
    vis.height = h;
    const ctx = vis.getContext('2d');
    const img = ctx.createImageData(w, h);
    const ink = new Uint8Array(w);
    for (let px = 0; px < w; px++) for (let py = 0; py < h; py++) if (field[py * w + px] > 0.5) { ink[px] = 1; break; }
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        const [x, y] = mapping.toWorld(px, py);
        let v = inf[i] * style.inflate * 0.9;
        if (style.drip) {
          const amt = dripAmount(nz, x, style, k);
          const below = (mapping.ymin - y) / Math.max(amt, 1e-3);
          if (field[i] < 0.5 && amt > 0.02 && below > -0.05 && below < 1 && ink[px]) v = Math.max(v, (1 - below) * 0.55);
        }
        if (style.bumps) v += field[i] * nz.fbm3(x * 6, y * 6, 0.3, 3) * 0.6;
        if (style.crack) v -= field[i] * smoothstep(0.86, 0.97, 1 - Math.abs(nz.noise3(x * 2.6, y * 2.6, 0.4))) * 0.5;
        if (style.ripple) v += field[i] * Math.sin(x * 6 + nz.noise3(x, y, 1) * 3) * 0.12;
        if (style.jitter) v += field[i] * nz.noise3(x * 3, y * 3, 2) * 0.25;
        const g = Math.round(clamp(v * k + (field[i] > 0.5 ? 0.12 : 0)) * 255);
        img.data.set([g, g, g, 255], i * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    return { inf, vis };
  }

  function dripAmount(nz, x, style, k) {
    if (!style.drip) return 0;
    const n = nz.noise3(x * 1.9, 0.5, 3.1) + 0.5 * nz.noise3(x * 5.3, 1.5, 7.7);
    return Math.max(0, n * 1.4 + 0.1) ** 1.5 * style.drip * 0.85 * k;
  }

  async function build() {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    refs.go.disabled = true;
    try {
      const t0 = performance.now();
      const text = refs.text.value.trim() || 'TYPE';
      const font = FONTS[refs.font.value];
      const prompt = refs.prompt.value.trim() || PROMPTS[0];
      const { style, tint, colorWord, toks, guessed } = interpret(prompt);
      const k = +refs.strength.value;
      const depth = +refs.extrude.value;
      refs.strOut.textContent = `${k.toFixed(2)}×`;
      refs.depthOut.textContent = depth.toFixed(2);
      const nz = createNoise(hashString(prompt + text));

      setStep(refs.steps, 0);
      refs.status.textContent = 'Converting live text to outlines…';
      await wait(30);
      await document.fonts?.load(font.css).catch(() => {});
      outline = outlineText(text, font.css);
      const nested = nestLoops(outline.loops);
      // raster px → world units, keeping the text centred
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const l of outline.loops) for (const [x, y] of l) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const s = Math.min(4.2 / Math.max(1, maxX - minX), 1.7 / Math.max(1, maxY - minY));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const mapping = {
        toWorld: (px, py) => [(px - cx) * s, -(py - cy) * s],
        toPx: (x, y) => [x / s + cx, -y / s + cy],
        ymin: -(maxY - cy) * s,
        height: (maxY - minY) * s,
      };

      let anchorCount = 0;
      let svgPaths = '';
      const shapes = nested.map(({ outer, holes }) => {
        const toShape = (loop, ShapeCtor) => {
          const anchors = fitBezier(loop, { cornerDeg: 50 });
          anchorCount += anchors.length;
          svgPaths += anchorsToPath(anchors);
          const P = (x, y) => mapping.toWorld(x, y);
          const sh = new ShapeCtor();
          sh.moveTo(...P(anchors[0].x, anchors[0].y));
          for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            const b = anchors[(i + 1) % anchors.length];
            if (a.corner && b.corner) sh.lineTo(...P(b.x, b.y));
            else sh.bezierCurveTo(...P(a.outX, a.outY), ...P(b.inX, b.inY), ...P(b.x, b.y));
          }
          return sh;
        };
        const shape = toShape(outer, THREE.Shape);
        shape.holes = holes.map((hl) => toShape(hl, THREE.Path));
        return shape;
      });
      refs.outline.innerHTML = `<svg viewBox="${minX - 8} ${minY - 8} ${maxX - minX + 16} ${maxY - minY + 16}"><path d="${svgPaths}" fill-rule="evenodd"/></svg>`;
      refs.outlineCap.textContent = `Outlines · ${nested.length} paths · ${anchorCount} anchors`;

      setStep(refs.steps, 2);
      refs.status.textContent = `Generating depth map · “${prompt}”`;
      await wait(30);
      depthMap = computeDepth(style, k, mapping, nz);
      const dctx = refs.depth.getContext('2d');
      refs.depth.width = outline.width;
      refs.depth.height = outline.height;
      dctx.drawImage(depthMap.vis, 0, 0);

      setStep(refs.steps, 3);
      refs.status.textContent = 'Extruding and displacing mesh…';
      await wait(30);
      let geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -depth / 2);
      geo.deleteAttribute('uv');
      geo.deleteAttribute('normal');
      geo = new TessellateModifier(+refs.detail.value, 14).modify(geo);
      geo = mergeVertices(geo, 1e-4);
      const baseGeo = geo.clone();

      const pos = geo.attributes.position;
      const half = depth / 2 + 0.025;
      const { inf } = depthMap;
      const W = outline.width;
      const H = outline.height;
      const sample = (x, y) => {
        const [px, py] = mapping.toPx(x, y);
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return 0;
        const fx = px - x0;
        const fy = py - y0;
        const i = y0 * W + x0;
        return inf[i] * (1 - fx) * (1 - fy) + inf[i + 1] * fx * (1 - fy) + inf[i + W] * (1 - fx) * fy + inf[i + W + 1] * fx * fy;
      };
      const ymin = mapping.ymin;
      const tall = mapping.height;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const D = sample(x, y);
        const sz = clamp(z / half, -1, 1);
        let nx = x;
        let ny = y;
        let nzv = z + sz * style.inflate * 0.5 * D * k;
        if (style.drip) {
          const amt = dripAmount(nz, x, style, k);
          const wgt = smoothstep(ymin + tall * 0.62, ymin, y);
          ny -= amt * wgt * wgt;
          nzv += sz * amt * wgt * wgt * 0.12;
        }
        if (style.ripple) {
          nzv += sz * style.ripple * k * Math.sin(x * 6 + nz.noise3(x, y, 1) * 3) * (0.3 + D);
          nx += style.ripple * k * 0.4 * nz.noise3(x * 2, y * 2, z * 2 + 5);
        }
        if (style.bumps) {
          const b = nz.fbm3(x * 6, y * 6, z * 6, 3);
          nx += b * style.bumps * k;
          ny += nz.fbm3(x * 6 + 11, y * 6, z * 6, 3) * style.bumps * k;
          nzv += sz * b * style.bumps * 1.5 * k;
        }
        if (style.jitter) {
          nx += nz.noise3(x * 3, y * 3, z * 3) * style.jitter * k;
          ny += nz.noise3(x * 3 + 9, y * 3, z * 3) * style.jitter * k;
          nzv += nz.noise3(x * 3, y * 3 + 9, z * 3) * style.jitter * k;
        }
        if (style.crack) {
          const r = 1 - Math.abs(nz.noise3(x * 2.6, y * 2.6, 0.4));
          nzv -= sz * smoothstep(0.86, 0.97, r) * style.crack * k;
        }
        pos.setXYZ(i, nx, ny, nzv);
      }
      geo.computeVertexNormals();

      clearGroup();
      const color = tint;
      let mat;
      glow.intensity = 0;
      scene.environmentIntensity = 1;
      switch (style.id) {
        case 'ice':
          mat = new THREE.MeshPhysicalMaterial({ color: color || '#e3f6ff', transmission: 1, thickness: 0.9, roughness: 0.07, ior: 1.31, attenuationColor: color || '#79cfff', attenuationDistance: 1.2, clearcoat: 1, flatShading: true });
          break;
        case 'metal':
          mat = new THREE.MeshPhysicalMaterial({ color: color || '#e9ecf1', metalness: 1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04 });
          break;
        case 'lava': {
          mat = new THREE.MeshStandardMaterial({ color: '#2a1b15', roughness: 0.95, flatShading: true });
          const core = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#100500', emissive: color || '#ff3d00', emissiveIntensity: 1.7 }));
          baseGeo.computeVertexNormals();
          core.scale.set(0.992, 0.992, 0.82);
          group.add(core);
          glow.color.set(color || '#ff5a1a');
          glow.intensity = 6;
          scene.environmentIntensity = 0.4;
          break;
        }
        case 'candy':
          mat = new THREE.MeshPhysicalMaterial({ color: color || '#ff4f9a', transmission: 0.6, thickness: 1.3, roughness: 0.1, ior: 1.45, clearcoat: 1, attenuationColor: color || '#ff2f7f', attenuationDistance: 0.7 });
          break;
        case 'stone': {
          const n = geo.attributes.normal;
          const cols = new Float32Array(pos.count * 3);
          const moss = new THREE.Color(color || '#5f8a3a');
          const rock = new THREE.Color('#8a8b85');
          const tmp = new THREE.Color();
          for (let i = 0; i < pos.count; i++) {
            const f = nz.fbm3(pos.getX(i) * 3, pos.getY(i) * 3, pos.getZ(i) * 3, 3);
            const m = smoothstep(0.1, 0.6, n.getY(i)) * smoothstep(-0.15, 0.15, f);
            tmp.copy(rock).multiplyScalar(0.8 + f * 0.6).lerp(moss, m);
            cols.set([tmp.r, tmp.g, tmp.b], i * 3);
          }
          geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
          mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
          break;
        }
        case 'balloon':
          mat = new THREE.MeshPhysicalMaterial({ color: color || '#ffcf5a', metalness: 1, roughness: 0.16, clearcoat: 0.7 });
          break;
        default: {
          const tube = color || '#ff3fd1';
          mat = new THREE.MeshPhysicalMaterial({ color: tube, emissive: tube, emissiveIntensity: 0.9, roughness: 0.2, clearcoat: 1 });
          // Additive back-face shell fakes the tube's halo without a post-processing pass.
          const haloGeo = geo.clone();
          const hp = haloGeo.attributes.position;
          const hn = haloGeo.attributes.normal;
          for (let i = 0; i < hp.count; i++) {
            hp.setXYZ(i, hp.getX(i) + hn.getX(i) * 0.05, hp.getY(i) + hn.getY(i) * 0.05, hp.getZ(i) + hn.getZ(i) * 0.05);
          }
          const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: tube, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
          group.add(halo);
          glow.color.set(tube);
          glow.intensity = 5;
          scene.environmentIntensity = 0.35;
        }
      }
      if (style.id !== 'lava') baseGeo.dispose();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${text}-${style.id}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const dark = ['lava', 'neon', 'metal'].includes(style.id);
      scene.background?.dispose?.();
      scene.background = dark ? gradientTexture('#1a1d26', '#06070a') : gradientTexture('#2a3140', '#0d0f14');
      setStep(refs.steps, 4);
      const ms = Math.round(performance.now() - t0);
      refs.status.textContent = `${style.label} · ${geo.index.count / 3 | 0} triangles · ${ms} ms`;

      const tokens = toks.map((t) => `<span class="token${style.words.includes(t) || t === colorWord ? ' is-hit' : ''}">${escapeHtml(t)}</span>`).join('');
      const fx = [style.drip && 'gravity drips', style.ripple && 'surface ripples', style.crack && 'emissive cracks', style.bumps && 'fractal bumps', style.jitter && 'crystal facets', 'pillow inflation'].filter(Boolean);
      refs.ai.innerHTML = `
        <div class="ai-card-grid">
          <div><div class="label">Prompt tokens</div><div class="tokens">${tokens}</div></div>
          <div><div class="label">Material</div><div><b>${style.label}</b>${guessed ? ' <span class="muted">(no keyword match, picked from prompt hash)</span>' : ''}</div></div>
          <div><div class="label">Tint</div><div>${color ? `<i class="swatch" style="background:${color}"></i> ${colorWord}` : 'material default'}</div></div>
          <div><div class="label">Displacement layers</div><div>${fx.join(' · ')}</div></div>
          <div><div class="label">Mesh</div><div>${(geo.index.count / 3) | 0} tris · ${pos.count.toLocaleString()} verts</div></div>
        </div>
        <p class="fine">The depth map is generated in the browser from the outline mask plus prompt-driven noise, standing in for an AI depth-map model. The same field displaces the tessellated mesh, so the 2D map and the 3D result always match.</p>`;
    } finally {
      building = false;
      refs.go.disabled = false;
      if (queued) {
        queued = false;
        build();
      }
    }
  }

  const rebuild = debounce(build, 250);
  refs.go.addEventListener('click', build);
  refs.prompt.addEventListener('keydown', (e) => e.key === 'Enter' && build());
  refs.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    refs.prompt.value = b.textContent;
    build();
  });
  ['text', 'strength', 'extrude'].forEach((k) => refs[k].addEventListener('input', rebuild));
  ['font', 'detail'].forEach((k) => refs[k].addEventListener('change', rebuild));
  refs.glb.addEventListener('click', () => {
    new GLTFExporter().parse(
      group,
      (buf) => downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), '3d-type.glb'),
      (err) => console.error(err),
      { binary: true }
    );
  });
  refs.map.addEventListener('click', () => depthMap && downloadDataUrl(depthMap.vis.toDataURL('image/png'), 'depth-map.png'));

  await document.fonts?.ready;
  await build();

  return { activate: () => stage.start(), deactivate: () => stage.stop() };
}
