// Demo 04 — Rough 2D sketch → cleaned Bézier path (anchor optimisation) → 3D extrusion with AI-suggested lighting.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { createStage, gradientTexture } from '../lib/stage.js';
import { mountTemplate, setStep, debounce, downloadBlob, downloadText, escapeHtml } from '../lib/dom.js';
import { mulberry32 } from '../lib/noise.js';
import { simplifyClosed, fitBezier, anchorsToPath } from '../lib/trace.js';

const PAD = 420; // sketch pad logical size

const RIGS = [
  { id: 'golden', name: 'Golden hour', words: ['golden', 'warm', 'sunset', 'sunrise', 'nostalgic', 'cozy', 'autumn', 'honey', 'vintage', 'summer'], bg: ['#3b2216', '#120a07'], key: { color: '#ffb46b', i: 3.4, az: -60, el: 18, k: '3200K' }, fill: { color: '#6d8bd8', i: 0.5 }, rim: { color: '#ffd59a', i: 2.2 }, mat: { color: '#e9d7c3', metalness: 0.0, roughness: 0.55, clearcoat: 0.2 }, exposure: 1.05 },
  { id: 'studio', name: 'Clean studio', words: ['studio', 'clean', 'product', 'minimal', 'neutral', 'catalog', 'commercial', 'white', 'simple', 'apple'], bg: ['#eceef2', '#c9ccd3'], key: { color: '#ffffff', i: 2.8, az: -40, el: 45, k: '5600K' }, fill: { color: '#ffffff', i: 1.0 }, rim: { color: '#ffffff', i: 1.5 }, mat: { color: '#f4f4f6', metalness: 0.0, roughness: 0.25, clearcoat: 0.8 }, exposure: 1.0 },
  { id: 'noir', name: 'Film noir', words: ['noir', 'dramatic', 'mystery', 'dark', 'moody', 'shadow', 'thriller', 'serious', 'luxury', 'black'], bg: ['#0b0c10', '#020203'], key: { color: '#e8eef8', i: 4.2, az: 70, el: 55, k: '6000K' }, fill: { color: '#334', i: 0.08 }, rim: { color: '#8fb3ff', i: 3.2 }, mat: { color: '#3a3d45', metalness: 0.3, roughness: 0.28, clearcoat: 1 }, exposure: 1.1 },
  { id: 'neon', name: 'Neon cyber', words: ['neon', 'cyber', 'cyberpunk', 'futuristic', 'future', 'synth', 'synthwave', 'electric', 'gaming', 'club', 'rave', 'tech'], bg: ['#140533', '#05010f'], key: { color: '#ff3cac', i: 3.2, az: -70, el: 25, k: 'magenta gel' }, fill: { color: '#2b86c5', i: 1.6 }, rim: { color: '#00f5d4', i: 3.0 }, mat: { color: '#9aa0b4', metalness: 0.8, roughness: 0.28, clearcoat: 0.6 }, exposure: 1.15 },
  { id: 'pastel', name: 'Dreamy pastel', words: ['dreamy', 'pastel', 'soft', 'calm', 'gentle', 'cute', 'kawaii', 'baby', 'cloud', 'sweet', 'playful', 'happy'], bg: ['#ffe3f1', '#d7d4ff'], key: { color: '#ffd1e8', i: 2.4, az: -30, el: 40, k: '4800K' }, fill: { color: '#c7e9ff', i: 1.4 }, rim: { color: '#ffffff', i: 1.4 }, mat: { color: '#ffc4dd', metalness: 0.0, roughness: 0.45, clearcoat: 0.5 }, exposure: 1.05 },
  { id: 'moon', name: 'Moonlight', words: ['moon', 'moonlight', 'night', 'cold', 'icy', 'winter', 'blue', 'lonely', 'quiet', 'calm', 'sad'], bg: ['#0e1a33', '#04070f'], key: { color: '#9db4ff', i: 2.8, az: 50, el: 35, k: '7500K' }, fill: { color: '#1d2a4a', i: 0.4 }, rim: { color: '#c9d7ff', i: 2.2 }, mat: { color: '#b9c6e0', metalness: 0.6, roughness: 0.3, clearcoat: 0.4 }, exposure: 1.0 },
  { id: 'fire', name: 'Fierce energy', words: ['fire', 'energy', 'aggressive', 'bold', 'power', 'sport', 'angry', 'hot', 'loud', 'action', 'explosive'], bg: ['#3a0b05', '#0c0201'], key: { color: '#ff4d00', i: 3.6, az: -50, el: 20, k: '1900K' }, fill: { color: '#ffb000', i: 0.7 }, rim: { color: '#ffd000', i: 3.0 }, mat: { color: '#8a7a6a', metalness: 0.9, roughness: 0.32, clearcoat: 0.2 }, exposure: 1.1 },
  { id: 'nature', name: 'Fresh daylight', words: ['nature', 'fresh', 'organic', 'green', 'eco', 'spring', 'garden', 'healthy', 'morning', 'bright', 'friendly'], bg: ['#e9f6e4', '#a9cfa0'], key: { color: '#fff3d6', i: 2.8, az: -45, el: 50, k: '5200K' }, fill: { color: '#a8e6a1', i: 1.0 }, rim: { color: '#ffffff', i: 1.2 }, mat: { color: '#5aa864', metalness: 0.0, roughness: 0.5, clearcoat: 0.3 }, exposure: 1.0 },
];

const MOODS = ['golden hour nostalgia', 'clean product studio', 'dark dramatic noir', 'neon cyberpunk', 'dreamy pastel calm', 'fierce bold energy'];

function presetShape(kind, seed = 3) {
  const rand = mulberry32(seed);
  const pts = [];
  const cx = PAD / 2;
  const cy = PAD / 2;
  const n = 260;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * Math.PI * 2;
    let r;
    let x;
    let y;
    if (kind === 'star') {
      const k = 5;
      const seg = (t * k * 2) % 2;
      const outer = 150;
      const inner = 64;
      const rr = seg < 1 ? outer + (inner - outer) * seg : inner + (outer - inner) * (seg - 1);
      r = rr;
      x = cx + Math.cos(a - Math.PI / 2) * r;
      y = cy + Math.sin(a - Math.PI / 2) * r;
    } else if (kind === 'heart') {
      x = cx + 9.2 * 16 * Math.sin(a) ** 3;
      y = cy - 9.2 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) + 10;
    } else if (kind === 'blob') {
      r = 120 + 34 * Math.sin(3 * a) + 18 * Math.cos(5 * a + 1);
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r;
    } else {
      // lightning bolt polygon traced along its perimeter
      const poly = [[230, 40], [110, 230], [200, 230], [160, 380], [310, 170], [215, 170], [270, 40]];
      const per = poly.map((p, i) => Math.hypot(poly[(i + 1) % poly.length][0] - p[0], poly[(i + 1) % poly.length][1] - p[1]));
      const total = per.reduce((s, v) => s + v, 0);
      let d = t * total;
      let j = 0;
      while (d > per[j]) d -= per[j++];
      const p = poly[j];
      const q = poly[(j + 1) % poly.length];
      x = p[0] + ((q[0] - p[0]) * d) / per[j];
      y = p[1] + ((q[1] - p[1]) * d) / per[j];
    }
    // hand-drawn wobble
    x += (rand() - 0.5) * 5 + Math.sin(i * 0.31) * 2;
    y += (rand() - 0.5) * 5 + Math.cos(i * 0.27) * 2;
    pts.push([x, y]);
  }
  return pts;
}

function dedupe(points, minDist = 1.5) {
  const out = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist) out.push(p);
  }
  return out;
}

/** Light moving-average pass that removes hand jitter before simplification. */
function smoothClosed(points, radius = 1) {
  const n = points.length;
  if (n < radius * 2 + 3) return points;
  return points.map((_, i) => {
    let x = 0;
    let y = 0;
    for (let k = -radius; k <= radius; k++) {
      const p = points[(i + k + n) % n];
      x += p[0];
      y += p[1];
    }
    return [x / (radius * 2 + 1), y / (radius * 2 + 1)];
  });
}

function interpretMood(text) {
  const toks = (text.toLowerCase().match(/[a-z]+/g) || []);
  const scored = RIGS.map((r) => ({ r, hits: toks.filter((t) => r.words.includes(t)) })).map((x) => ({ ...x, s: x.hits.length })).sort((a, b) => b.s - a.s);
  const total = scored.reduce((s, x) => s + x.s, 0);
  if (!total) return { rig: RIGS[1], alt: null, conf: 1, hits: [], fallback: true, toks };
  const a = scored[0];
  const b = scored[1].s ? scored[1] : null;
  return { rig: a.r, alt: b && { rig: b.r, conf: b.s / total }, conf: a.s / total, hits: [...a.hits, ...(b ? b.hits : [])], toks };
}

function lightPos(az, el, dist = 6) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist + 0.4, Math.cos(a) * Math.cos(e) * dist);
}

export async function mount(root) {
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="viewport" data-ref="stage">
        <div class="viewport-badge" data-ref="status">Extruded from your sketch</div>
        <div class="viewport-hint">Drag to orbit · scroll to zoom</div>
      </div>
      <ol class="steps" data-ref="steps"><li>Sketch</li><li>Clean anchors</li><li>Extrude</li><li>Mood lighting</li></ol>
    </div>
    <div class="demo-side">
      <div class="mini-card">
        <div class="mini-card-head"><span>Artboard · draw a closed shape</span><span data-ref="counts"></span></div>
        <canvas class="sketch" data-ref="pad" width="${PAD}" height="${PAD}" aria-label="Sketch pad: draw a shape with your mouse or finger"></canvas>
        <div class="chips" data-ref="presets">
          <button class="chip" data-shape="star" type="button">Rough star</button>
          <button class="chip" data-shape="bolt" type="button">Bolt</button>
          <button class="chip" data-shape="heart" type="button">Heart</button>
          <button class="chip" data-shape="blob" type="button">Blob</button>
          <label class="toggle small"><input type="checkbox" data-ref="showRaw" checked /> <span>raw stroke</span></label>
          <label class="toggle small"><input type="checkbox" data-ref="showHandles" checked /> <span>handles</span></label>
        </div>
      </div>
      <div class="field-grid">
        <label class="field"><span>Simplify tolerance <output data-ref="epsOut"></output></span><input type="range" min="1" max="16" step="0.5" value="5" data-ref="eps" /></label>
        <label class="field"><span>Corner angle <output data-ref="cornerOut"></output></span><input type="range" min="15" max="90" value="48" data-ref="corner" /></label>
        <label class="field"><span>Depth <output data-ref="depthOut"></output></span><input type="range" min="0.1" max="1.6" step="0.05" value="0.6" data-ref="depth" /></label>
        <label class="field"><span>Bevel <output data-ref="bevelOut"></output></span><input type="range" min="0" max="0.12" step="0.005" value="0.04" data-ref="bevel" /></label>
      </div>
      <div class="prompt-row">
        <input data-ref="mood" value="${MOODS[0]}" aria-label="Mood" />
        <button class="btn btn-primary" data-ref="suggest" type="button">Suggest lighting</button>
      </div>
      <div class="chips" data-ref="moods">${MOODS.map((m) => `<button class="chip" type="button">${m}</button>`).join('')}</div>
      <div class="btn-row">
        <button class="btn" data-ref="svg" type="button">Export SVG</button>
        <button class="btn" data-ref="obj" type="button">Export OBJ</button>
        <button class="btn" data-ref="glb" type="button">Export GLB</button>
      </div>
    </div>
    <div class="demo-foot"><div class="ai-card" data-ref="rig"></div></div>
  </div>`
  );

  const stage = createStage(refs.stage, { camera: [2.2, 1.4, 5.4], target: [0, 0.2, 0], background: 0x1a1c22, minDistance: 2.5, maxDistance: 12 });
  const { scene } = stage;
  const key = new THREE.SpotLight(0xffffff, 60, 30, 0.6, 0.6, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  const rimL = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(key, key.target, fill, rimL);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.25;
  floor.receiveShadow = true;
  scene.add(floor);
  const material = new THREE.MeshPhysicalMaterial({ color: '#e9d7c3', roughness: 0.5 });
  let mesh = null;

  const ctx = refs.pad.getContext('2d');
  let raw = presetShape('star');
  let anchors = [];
  let drawing = false;
  let stroke = [];

  function clean() {
    const eps = +refs.eps.value;
    const corner = +refs.corner.value;
    refs.epsOut.textContent = `${eps}px`;
    refs.cornerOut.textContent = `${corner}°`;
    const pts = dedupe(raw);
    const simple = simplifyClosed(smoothClosed(pts), eps);
    anchors = simple.length >= 3 ? fitBezier(simple, { cornerDeg: corner }) : [];
    const corners = anchors.filter((a) => a.corner).length;
    const pct = pts.length ? Math.round((1 - anchors.length / pts.length) * 100) : 0;
    refs.counts.innerHTML = `<b>${pts.length}</b> raw → <b>${anchors.length}</b> anchors <span class="muted">(−${pct}%, ${corners} corner · ${anchors.length - corners} smooth)</span>`;
    drawPad();
  }

  function drawPad() {
    const c = ctx;
    c.clearRect(0, 0, PAD, PAD);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, PAD, PAD);
    c.strokeStyle = '#eef0f4';
    c.lineWidth = 1;
    for (let i = 0; i <= PAD; i += 20) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, PAD);
      c.moveTo(0, i);
      c.lineTo(PAD, i);
      c.stroke();
    }
    const src = drawing ? stroke : raw;
    if (refs.showRaw.checked || drawing) {
      c.strokeStyle = drawing ? '#1f2328' : 'rgba(31,35,40,0.35)';
      c.lineWidth = drawing ? 2.5 : 2;
      c.lineJoin = 'round';
      c.beginPath();
      src.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      if (!drawing) c.closePath();
      c.stroke();
    }
    if (drawing || anchors.length < 3) return;
    c.fillStyle = 'rgba(255,122,26,0.14)';
    c.strokeStyle = '#ff7a1a';
    c.lineWidth = 2;
    const p = new Path2D(anchorsToPath(anchors));
    c.fill(p);
    c.stroke(p);
    if (refs.showHandles.checked) {
      c.strokeStyle = '#2f7bff';
      c.fillStyle = '#2f7bff';
      c.lineWidth = 1;
      for (const a of anchors) {
        if (a.corner) continue;
        c.beginPath();
        c.moveTo(a.inX, a.inY);
        c.lineTo(a.outX, a.outY);
        c.stroke();
        for (const [hx, hy] of [[a.inX, a.inY], [a.outX, a.outY]]) {
          c.beginPath();
          c.arc(hx, hy, 2.6, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    for (const a of anchors) {
      c.fillStyle = a.corner ? '#2f7bff' : '#ffffff';
      c.strokeStyle = '#2f7bff';
      c.lineWidth = 1.5;
      c.fillRect(a.x - 3.5, a.y - 3.5, 7, 7);
      c.strokeRect(a.x - 3.5, a.y - 3.5, 7, 7);
    }
  }

  function buildShape() {
    if (anchors.length < 3) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const a of anchors) {
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y);
      maxY = Math.max(maxY, a.y);
    }
    const s = 2.4 / Math.max(maxX - minX, maxY - minY, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const T = (x, y) => [(x - cx) * s, -(y - cy) * s];
    const shape = new THREE.Shape();
    shape.moveTo(...T(anchors[0].x, anchors[0].y));
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const b = anchors[(i + 1) % anchors.length];
      if (a.corner && b.corner) shape.lineTo(...T(b.x, b.y));
      else shape.bezierCurveTo(...T(a.outX, a.outY), ...T(b.inX, b.inY), ...T(b.x, b.y));
    }
    return shape;
  }

  function extrude() {
    const depth = +refs.depth.value;
    const bevel = +refs.bevel.value;
    refs.depthOut.textContent = depth.toFixed(2);
    refs.bevelOut.textContent = bevel.toFixed(3);
    const shape = buildShape();
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
    if (!shape) return;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel * 0.9,
      bevelSegments: 5,
      curveSegments: 24,
    });
    geo.center();
    mesh = new THREE.Mesh(geo, material);
    mesh.name = 'ExtrudedSketch';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = 0.05;
    scene.add(mesh);
    setStep(refs.steps, 3);
  }

  function applyMood() {
    const r = interpretMood(refs.mood.value);
    const rig = r.rig;
    scene.background?.dispose?.();
    scene.background = gradientTexture(rig.bg[0], rig.bg[1]);
    key.color.set(rig.key.color);
    key.intensity = rig.key.i * 18;
    key.position.copy(lightPos(rig.key.az, rig.key.el, 7));
    fill.color.set(rig.fill.color);
    fill.intensity = rig.fill.i;
    fill.position.copy(lightPos(rig.key.az + 140, 15));
    rimL.color.set(rig.rim.color);
    rimL.intensity = rig.rim.i;
    rimL.position.copy(lightPos(rig.key.az + 200, 35));
    material.color.set(rig.mat.color);
    material.metalness = rig.mat.metalness;
    material.roughness = rig.mat.roughness;
    material.clearcoat = rig.mat.clearcoat;
    stage.renderer.toneMappingExposure = rig.exposure;
    scene.environmentIntensity = rig.id === 'noir' || rig.id === 'neon' || rig.id === 'fire' || rig.id === 'moon' ? 0.5 : 0.8;
    floor.material.opacity = rig.id === 'studio' || rig.id === 'pastel' || rig.id === 'nature' ? 0.22 : 0.45;
    setStep(refs.steps, 4);
    refs.status.textContent = `${rig.name} rig applied`;
    const sw = (c) => `<i class="swatch" style="background:${c}"></i>`;
    const toks = r.toks.map((t) => `<span class="token${r.hits.includes(t) ? ' is-hit' : ''}">${escapeHtml(t)}</span>`).join('');
    refs.rig.innerHTML = `
      <div class="ai-card-grid">
        <div><div class="label">Mood tokens</div><div class="tokens">${toks || '<span class="muted">—</span>'}</div></div>
        <div><div class="label">Suggested rig</div><div><b>${rig.name}</b> ${Math.round(r.conf * 100)}%${r.alt ? ` · runner-up ${r.alt.rig.name} ${Math.round(r.alt.conf * 100)}%` : ''}${r.fallback ? ' <span class="muted">(no mood keywords, using studio default)</span>' : ''}</div></div>
        <div><div class="label">Key light</div><div>${sw(rig.key.color)} ${rig.key.k} · az ${rig.key.az}° · el ${rig.key.el}° · ×${rig.key.i}</div></div>
        <div><div class="label">Fill / rim</div><div>${sw(rig.fill.color)} fill ×${rig.fill.i} · ${sw(rig.rim.color)} rim ×${rig.rim.i}</div></div>
        <div><div class="label">Material</div><div>${sw(rig.mat.color)} metal ${rig.mat.metalness} · rough ${rig.mat.roughness} · clearcoat ${rig.mat.clearcoat}</div></div>
      </div>`;
  }

  const rebuild = () => {
    clean();
    extrude();
  };

  // Pointer drawing
  const toPad = (e) => {
    const r = refs.pad.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * PAD, ((e.clientY - r.top) / r.height) * PAD];
  };
  refs.pad.addEventListener('pointerdown', (e) => {
    drawing = true;
    stroke = [toPad(e)];
    refs.pad.setPointerCapture(e.pointerId);
    setStep(refs.steps, 0);
    refs.status.textContent = 'Sketching…';
    drawPad();
  });
  refs.pad.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evts) stroke.push(toPad(ev));
    drawPad();
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    if (dedupe(stroke).length > 12) {
      raw = stroke;
      setStep(refs.steps, 1);
      rebuild();
      applyMood();
      refs.status.textContent = 'Extruded from your sketch';
    } else drawPad();
  };
  refs.pad.addEventListener('pointerup', finish);
  refs.pad.addEventListener('pointercancel', finish);

  refs.presets.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shape]');
    if (!b) return;
    raw = presetShape(b.dataset.shape, b.dataset.shape.length * 7);
    rebuild();
    applyMood();
  });
  const rebuildSoon = debounce(rebuild, 40);
  refs.eps.addEventListener('input', rebuildSoon);
  refs.corner.addEventListener('input', rebuildSoon);
  refs.depth.addEventListener('input', debounce(extrude, 40));
  refs.bevel.addEventListener('input', debounce(extrude, 40));
  refs.showRaw.addEventListener('change', drawPad);
  refs.showHandles.addEventListener('change', drawPad);
  refs.suggest.addEventListener('click', applyMood);
  refs.mood.addEventListener('keydown', (e) => e.key === 'Enter' && applyMood());
  refs.moods.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    refs.mood.value = b.textContent;
    applyMood();
  });

  refs.svg.addEventListener('click', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAD} ${PAD}"><path d="${anchorsToPath(anchors)}" fill="#ff7a1a"/></svg>`;
    downloadText(svg, 'clean-path.svg', 'image/svg+xml');
  });
  refs.obj.addEventListener('click', () => {
    if (mesh) downloadText(new OBJExporter().parse(mesh), 'extrusion.obj', 'text/plain');
  });
  refs.glb.addEventListener('click', () => {
    if (!mesh) return;
    new GLTFExporter().parse(
      mesh,
      (buf) => downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), 'extrusion.glb'),
      (err) => console.error(err),
      { binary: true }
    );
  });

  rebuild();
  applyMood();

  return { activate: () => stage.start(), deactivate: () => stage.stop() };
}
