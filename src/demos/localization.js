// Demo 03 — Batch localisation: CSV of locales → translations → typography auto-fit → 20 labels → 20 3D renders.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createStage, gradientTexture } from '../lib/stage.js';
import { mountTemplate, setStep, nextFrame, wait, downloadDataUrl, escapeHtml } from '../lib/dom.js';
import { mulberry32, hashString } from '../lib/noise.js';

const MASTER = {
  descriptor: 'Sparkling Mineral Water',
  tagline: 'Naturally refreshing',
  body: 'Bottled at the source',
};

// Translation memory: cached LLM output for the demo locales.
const TM = {
  es: ['Agua mineral con gas', 'Naturalmente refrescante', 'Embotellada en el manantial'],
  fr: ['Eau minérale gazeuse', 'Naturellement rafraîchissante', 'Mise en bouteille à la source'],
  de: ['Mineralwasser mit Kohlensäure', 'Natürlich erfrischend', 'An der Quelle abgefüllt'],
  it: ['Acqua minerale frizzante', 'Naturalmente rinfrescante', 'Imbottigliata alla fonte'],
  'pt-BR': ['Água mineral com gás', 'Naturalmente refrescante', 'Engarrafada na fonte'],
  nl: ['Bruisend mineraalwater', 'Natuurlijk verfrissend', 'Gebotteld aan de bron'],
  sv: ['Kolsyrat mineralvatten', 'Naturligt uppfriskande', 'Buteljerat vid källan'],
  pl: ['Woda mineralna gazowana', 'Naturalnie orzeźwiająca', 'Butelkowana u źródła'],
  tr: ['Gazlı Maden Suyu', 'Doğal ferahlık', 'Kaynağında şişelenmiştir'],
  ru: ['Газированная минеральная вода', 'Естественная свежесть', 'Разлито у источника'],
  el: ['Ανθρακούχο μεταλλικό νερό', 'Φυσικά δροσιστικό', 'Εμφιαλωμένο στην πηγή'],
  ar: ['مياه معدنية فوارة', 'منعشة بطبيعتها', 'معبأة من المصدر'],
  he: ['מים מינרליים מוגזים', 'מרענן באופן טבעי', 'בוקבק במקור'],
  hi: ['स्पार्कलिंग मिनरल वॉटर', 'प्राकृतिक ताज़गी', 'स्रोत पर बोतलबंद'],
  ja: ['スパークリング ミネラルウォーター', '自然な爽快感', '採水地でボトリング'],
  ko: ['스파클링 미네랄 워터', '자연 그대로의 상쾌함', '수원지에서 직접 병입'],
  'zh-CN': ['含气天然矿泉水', '自然清爽', '水源地直接灌装'],
  th: ['น้ำแร่อัดลม', 'สดชื่นอย่างเป็นธรรมชาติ', 'บรรจุขวดจากแหล่งต้นน้ำ'],
  vi: ['Nước khoáng có ga', 'Sảng khoái tự nhiên', 'Đóng chai tại nguồn'],
  id: ['Air Mineral Berkarbonasi', 'Segar alami', 'Dikemas langsung dari sumbernya'],
};

const DEFAULT_CSV = `code,language,direction
es,Spanish,ltr
fr,French,ltr
de,German,ltr
it,Italian,ltr
pt-BR,Portuguese (Brazil),ltr
nl,Dutch,ltr
sv,Swedish,ltr
pl,Polish,ltr
tr,Turkish,ltr
ru,Russian,ltr
el,Greek,ltr
ar,Arabic,rtl
he,Hebrew,rtl
hi,Hindi,ltr
ja,Japanese,ltr
ko,Korean,ltr
zh-CN,Chinese (Simplified),ltr
th,Thai,ltr
vi,Vietnamese,ltr
id,Indonesian,ltr`;

const LW = 1400;
const LH = 520;
const HEADING = '"Space Grotesk", "Inter", "Noto Sans", system-ui, sans-serif';
const BODY = '"Inter", "Noto Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans Devanagari", "Noto Sans Thai", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", system-ui, sans-serif';
// Scripts where letter-spacing breaks shaping (joining, conjuncts) — resize only.
const NO_TRACKING = new Set(['ar', 'he', 'hi', 'th']);

const BOXES = {
  descriptor: { x: LW * 0.375, y: 214, w: LW * 0.25, h: 96, max: 46, min: 16, maxLines: 2, weight: 700 },
  tagline: { x: LW * 0.375, y: 322, w: LW * 0.25, h: 44, max: 30, min: 12, maxLines: 1, weight: 500 },
  body: { x: LW * 0.05, y: 206, w: LW * 0.22, h: 104, max: 32, min: 12, maxLines: 3, weight: 500 },
};

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map((l) => l.split(',').map((s) => s.trim()));
  const head = rows.shift()?.map((h) => h.toLowerCase()) || [];
  const ci = head.indexOf('code');
  const li = head.indexOf('language');
  const di = head.indexOf('direction');
  return rows
    .filter((r) => r[ci])
    .map((r) => ({ code: r[ci], language: r[li] || r[ci], dir: (r[di] || 'ltr').toLowerCase() === 'rtl' ? 'rtl' : 'ltr' }));
}

const segmenters = new Map();
function segments(text, lang) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    let s = segmenters.get(lang);
    if (!s) {
      try {
        s = new Intl.Segmenter(lang, { granularity: 'word' });
      } catch {
        s = new Intl.Segmenter('en', { granularity: 'word' });
      }
      segmenters.set(lang, s);
    }
    return [...s.segment(text)].map((x) => x.segment);
  }
  return /[฀-๿぀-ヿ一-鿿]/.test(text) ? [...text] : text.split(/(\s+)/);
}

function measure(ctx, text, size, tracking) {
  return ctx.measureText(text).width + tracking * size * Math.max(0, [...text].length - 1);
}

function wrap(ctx, text, lang, maxW, size, tracking) {
  const segs = segments(text, lang);
  const lines = [];
  let line = '';
  for (const seg of segs) {
    const cand = line + seg;
    if (!line.trim() || measure(ctx, cand.trimEnd(), size, tracking) <= maxW) line = cand;
    else {
      lines.push(line.trim());
      line = seg.trimStart();
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Shrink-to-fit: try tighter tracking first, then smaller sizes, wrapping within maxLines. */
function fitText(ctx, text, box, lang, family) {
  const tracks = NO_TRACKING.has(lang) ? [0] : [0, -0.01, -0.02, -0.03];
  const lh = 1.18;
  for (let size = box.max; size >= box.min; size -= 1) {
    ctx.font = `${box.weight} ${size}px ${family}`;
    for (const tr of tracks) {
      const lines = wrap(ctx, text, lang, box.w, size, tr);
      if (lines.length <= box.maxLines && lines.length * size * lh <= box.h + 0.5 && lines.every((l) => measure(ctx, l, size, tr) <= box.w)) {
        return { size, tracking: tr, lines, ok: true };
      }
    }
  }
  ctx.font = `${box.weight} ${box.min}px ${family}`;
  return { size: box.min, tracking: tracks.at(-1), lines: wrap(ctx, text, lang, box.w, box.min, tracks.at(-1)), ok: false };
}

function drawFitted(ctx, fit, box, family, align, dir) {
  const lh = fit.size * 1.18;
  ctx.font = `${box.weight} ${fit.size}px ${family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(fit.tracking * fit.size).toFixed(2)}px`;
  ctx.direction = dir;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const y0 = box.y + (box.h - fit.lines.length * lh) / 2 + lh / 2;
  const x = align === 'center' ? box.x + box.w / 2 : align === 'right' ? box.x + box.w : box.x;
  fit.lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/**
 * What happens without auto-fit: the translation is pasted into the master's
 * frame at the master's size and tracking. Lines that don't fit are overset.
 */
function drawNaive(ctx, text, box, family, align, dir, lang, ref) {
  const size = ref?.size ?? box.max;
  const tracking = ref?.tracking ?? 0;
  ctx.font = `${box.weight} ${size}px ${family}`;
  const lines = wrap(ctx, text, lang, box.w, size, tracking);
  const lh = size * 1.18;
  const fitLines = Math.max(1, Math.min(box.maxLines, Math.floor((box.h + 0.5) / lh)));
  const over = lines.length > fitLines || lines.some((l) => measure(ctx, l, size, tracking) > box.w + 0.5);
  const shown = Math.min(lines.length, fitLines);
  const y0 = box.y + (box.h - shown * lh) / 2 + lh / 2;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
  ctx.direction = dir;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const x = align === 'center' ? box.x + box.w / 2 : align === 'right' ? box.x + box.w : box.x;
  lines.forEach((l, i) => {
    ctx.globalAlpha = i < fitLines ? 1 : 0.35; // overset text, hidden in Illustrator
    ctx.fillText(l, x, y0 + i * lh);
  });
  ctx.globalAlpha = 1;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  if (over) {
    ctx.save();
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(box.x + box.w - 22, box.y + box.h - 22, 22, 22);
    ctx.fillStyle = '#fff';
    ctx.font = `800 20px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.fillText('+', box.x + box.w - 11, box.y + box.h - 10);
    ctx.restore();
  }
  return { ok: !over, size, tracking, lines };
}

function mirrorBox(b) {
  return { ...b, x: LW - b.x - b.w };
}

function drawLabel(canvas, loc, autoFit, ref = null) {
  const ctx = canvas.getContext('2d');
  const rtl = loc.dir === 'rtl';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.direction = 'ltr';
  const g = ctx.createLinearGradient(0, 0, LW, LH);
  g.addColorStop(0, '#062a5c');
  g.addColorStop(0.55, '#0a5ea8');
  g.addColorStop(1, '#00a6a6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  const rand = mulberry32(7);
  for (let i = 0; i < 70; i++) {
    const r = 3 + rand() ** 2 * 26;
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + rand() * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rand() * LW, rand() * LH, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, LH);
  for (let x = 0; x <= LW; x += 20) ctx.lineTo(x, LH - 70 - Math.sin(x / 90) * 14);
  ctx.lineTo(LW, LH);
  ctx.fill();
  // Front panel card
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(LW * 0.31, 30, LW * 0.38, LH - 60);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 132px ${HEADING}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('AURA', LW / 2, 118);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.font = `600 18px ${BODY}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText('NATURAL SPRING · EST. 1987', LW / 2, 188);
  ctx.globalAlpha = 1;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  const t = loc.strings;
  const lang = loc.code;
  const bodyBox = rtl ? mirrorBox(BOXES.body) : BOXES.body;
  const sideAlign = rtl ? 'right' : 'left';
  const report = {};
  if (autoFit) {
    for (const [k, box, align] of [['descriptor', BOXES.descriptor, 'center'], ['tagline', BOXES.tagline, 'center'], ['body', bodyBox, sideAlign]]) {
      const fit = fitText(ctx, t[k], box, lang, BODY);
      ctx.fillStyle = k === 'tagline' ? '#bff6ff' : '#ffffff';
      drawFitted(ctx, fit, box, BODY, align, loc.dir);
      report[k] = fit;
    }
  } else {
    for (const [k, box, align] of [['descriptor', BOXES.descriptor, 'center'], ['tagline', BOXES.tagline, 'center'], ['body', bodyBox, sideAlign]]) {
      ctx.fillStyle = k === 'tagline' ? '#bff6ff' : '#ffffff';
      report[k] = drawNaive(ctx, t[k], box, BODY, align, loc.dir, lang, ref?.[k]);
    }
  }
  ctx.direction = 'ltr';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `700 40px ${HEADING}`;
  ctx.fillText('500 ml', LW / 2, 432);

  // Side panel extras: language badge, barcode
  const badgeX = rtl ? LW * 0.84 : LW * 0.16;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(badgeX - 70, 360, 140, 64);
  ctx.font = `700 32px ${HEADING}`;
  ctx.fillText(lang.toUpperCase(), badgeX, 393);
  const bx = rtl ? LW * 0.06 : LW * 0.76;
  const bw = LW * 0.18;
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx, 210, bw, 140);
  ctx.fillStyle = '#111';
  const br = mulberry32(hashString(lang));
  for (let x = bx + 14; x < bx + bw - 14; ) {
    const w = 2 + Math.floor(br() * 3) * 2;
    if (br() > 0.4) ctx.fillRect(x, 224, w, 92);
    x += w + 2;
  }
  ctx.font = `500 15px ${BODY}`;
  ctx.fillText(`AURA-${lang.toUpperCase()}-500`, bx + bw / 2, 334);
  return report;
}

function buildCan() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.22 });
  const labelMat = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.32 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.52, 128, 1, true, Math.PI, Math.PI * 2), labelMat);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.1, 128, 1, true), metal);
  lower.position.y = -0.81;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.04, 96), metal);
  base.position.y = -0.88;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.16, 128, 1, true), metal);
  upper.position.y = 0.84;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 96), metal);
  lid.position.y = 0.91;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.025, 16, 96), metal);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.93;
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.32), metal);
  tab.position.set(0, 0.93, 0.12);
  group.add(body, lower, base, upper, lid, rim, tab);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, labelMat };
}

export async function mount(root) {
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="viewport" data-ref="stage">
        <div class="viewport-badge" data-ref="status">Master label · EN</div>
        <div class="viewport-hint">Click a label below to load it on the can</div>
      </div>
      <ol class="steps" data-ref="steps"><li>Read CSV</li><li>Translate</li><li>Auto-fit type</li><li>Export labels</li><li>Batch render</li></ol>
    </div>
    <div class="demo-side">
      <div class="mini-card">
        <div class="mini-card-head"><span>Master artboard · AURA_label.ai</span><span>EN</span></div>
        <canvas class="label-canvas" data-ref="master" width="${LW}" height="${LH}"></canvas>
      </div>
      <label class="field"><span>Locales CSV <span class="muted" data-ref="csvCount"></span></span><textarea data-ref="csv" rows="7" spellcheck="false">${DEFAULT_CSV}</textarea></label>
      <label class="toggle"><input type="checkbox" data-ref="autofit" checked /> <span>Auto-fit typography (re-kern, resize, re-wrap)</span></label>
      <div class="btn-row">
        <button class="btn btn-primary" data-ref="run" type="button">Run batch</button>
        <button class="btn" data-ref="sheet" type="button" disabled>Download contact sheet</button>
        <button class="btn" data-ref="labelPng" type="button">Download selected label</button>
      </div>
      <div class="log" data-ref="log" aria-live="polite"></div>
    </div>
    <div class="demo-foot">
      <div class="foot-head"><h4>Exported labels</h4><span class="muted" data-ref="fitSummary"></span></div>
      <div class="label-grid" data-ref="grid"></div>
      <div class="foot-head"><h4>Batch renders</h4><span class="muted" data-ref="renderSummary">Run the batch to render every locale</span></div>
      <div class="progress"><i data-ref="bar"></i></div>
      <div class="render-grid" data-ref="renders"></div>
    </div>
  </div>`
  );

  const stage = createStage(refs.stage, { camera: [0, 0.6, 4.6], target: [0, 0.05, 0], background: 0x0f1218, minDistance: 2.2, maxDistance: 9 });
  const { scene } = stage;
  scene.background = gradientTexture('#1b2433', '#0b0e14');
  stage.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  stage.controls.autoRotateSpeed = 1.6;
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const rim = new THREE.DirectionalLight(0x7fdcff, 1.6);
  rim.position.set(-3, 2, -3);
  scene.add(key, rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: '#141922', roughness: 0.6, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  scene.add(floor);
  const can = buildCan();
  scene.add(can.group);

  const masterLoc = { code: 'en', language: 'English (master)', dir: 'ltr', strings: { ...MASTER } };
  let labels = [];
  let selected = null;
  let masterFit = null;
  let renders = [];
  let running = false;

  const makeTexture = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const masterTex = makeTexture(refs.master);
  can.labelMat.map = masterTex;

  function log(msg, cls = '') {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    refs.log.append(line);
    refs.log.scrollTop = refs.log.scrollHeight;
  }

  function selectLabel(item) {
    selected = item;
    const old = can.labelMat.map;
    can.labelMat.map = item ? item.texture : masterTex;
    can.labelMat.needsUpdate = old !== can.labelMat.map;
    refs.grid.querySelectorAll('.label-card').forEach((c) => c.classList.toggle('is-on', c.dataset.code === item?.loc.code));
    refs.status.textContent = item ? `${item.loc.language} · ${item.loc.code}` : 'Master label · EN';
  }

  // Differences from how the English master sets the same frames.
  function changes(fit) {
    const out = [];
    for (const k of ['descriptor', 'tagline', 'body']) {
      const f = fit[k];
      const m = masterFit?.[k];
      if (!f || !m) continue;
      if (f.size < m.size) out.push({ k, kind: 'size', v: Math.round((f.size / m.size) * 100) });
      if (f.tracking < m.tracking) out.push({ k, kind: 'track', v: Math.round(f.tracking * 100) });
      if (f.lines.length > m.lines.length) out.push({ k, kind: 'lines', v: f.lines.length });
    }
    return out;
  }

  function badge(fit) {
    if (Object.values(fit).some((f) => !f.ok)) return '<span class="tag tag-bad">overflow</span>';
    const byField = {};
    for (const c of changes(fit)) {
      (byField[c.k] ||= []).push(c.kind === 'size' ? `${c.v}%` : c.kind === 'track' ? `${c.v}% track` : `${c.v} lines`);
    }
    const parts = Object.entries(byField).map(([k, v]) => `${k} ${v.join(' ')}`);
    return parts.length ? `<span class="tag">${parts.join(' · ')}</span>` : '<span class="tag tag-ok">fits as-is</span>';
  }

  function renderLabels() {
    const autoFit = refs.autofit.checked;
    const t0 = performance.now();
    let overflows = 0;
    let adjusted = 0;
    labels.forEach((item) => {
      item.fit = drawLabel(item.canvas, item.loc, autoFit, masterFit);
      item.texture.needsUpdate = true;
      const bad = Object.values(item.fit).filter((f) => !f.ok).length;
      overflows += bad;
      if (autoFit && changes(item.fit).length) adjusted++;
    });
    const ms = Math.round(performance.now() - t0);
    refs.grid.innerHTML = '';
    labels.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'label-card';
      card.dataset.code = item.loc.code;
      card.innerHTML = `<span class="label-thumb"></span><span class="label-meta"><b>${escapeHtml(item.loc.language)}</b><span>${escapeHtml(item.loc.code)}${item.loc.dir === 'rtl' ? ' · RTL' : ''}${item.missing ? ' · <em>needs LLM</em>' : ''}</span>${badge(item.fit)}</span>`;
      const thumb = document.createElement('canvas');
      thumb.width = 280;
      thumb.height = 104;
      thumb.getContext('2d').drawImage(item.canvas, 0, 0, 280, 104);
      card.querySelector('.label-thumb').append(thumb);
      card.addEventListener('click', () => selectLabel(item));
      refs.grid.append(card);
    });
    if (selected) selectLabel(labels.find((l) => l.loc.code === selected.loc.code) || null);
    refs.fitSummary.textContent = autoFit
      ? `${labels.length} labels laid out in ${ms} ms · ${adjusted} auto-adjusted · ${overflows} overflow${overflows === 1 ? '' : 's'}`
      : `Auto-fit off · ${overflows} text frame${overflows === 1 ? '' : 's'} overflowing`;
    return { ms, overflows, adjusted };
  }

  function prepare() {
    const locs = parseCsv(refs.csv.value);
    refs.csvCount.textContent = `${locs.length} locales`;
    labels.forEach((l) => l.texture.dispose());
    labels = locs.map((loc) => {
      const tm = TM[loc.code];
      const canvas = document.createElement('canvas');
      canvas.width = LW;
      canvas.height = LH;
      return {
        loc: { ...loc, strings: tm ? { descriptor: tm[0], tagline: tm[1], body: tm[2] } : { ...MASTER } },
        missing: !tm,
        canvas,
        texture: makeTexture(canvas),
      };
    });
    return locs;
  }

  async function batchRender() {
    const W = 300;
    const H = 380;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(r);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    cam.position.set(0, 0.45, 4.9);
    cam.lookAt(0, 0.02, 0);
    const mainEnv = scene.environment;
    const rot = can.group.rotation.y;
    renders = [];
    refs.renders.innerHTML = '';
    const t0 = performance.now();
    for (let i = 0; i < labels.length; i++) {
      const item = labels[i];
      selectLabel(item);
      scene.environment = env;
      can.group.rotation.y = -0.18;
      r.render(scene, cam);
      const url = r.domElement.toDataURL('image/jpeg', 0.9);
      scene.environment = mainEnv;
      can.group.rotation.y = rot;
      renders.push({ url, loc: item.loc });
      const fig = document.createElement('figure');
      fig.innerHTML = `<img alt="3D render of the ${escapeHtml(item.loc.language)} can" src="${url}" /><figcaption>${escapeHtml(item.loc.code)}</figcaption>`;
      refs.renders.append(fig);
      refs.bar.style.width = `${((i + 1) / labels.length) * 100}%`;
      refs.renderSummary.textContent = `Rendering ${i + 1} / ${labels.length}…`;
      await nextFrame();
    }
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    env.dispose();
    pmrem.dispose();
    r.dispose();
    r.forceContextLoss();
    refs.renderSummary.textContent = `${renders.length} product shots rendered in ${secs} s`;
    return secs;
  }

  async function run() {
    if (running) return;
    running = true;
    refs.run.disabled = true;
    refs.sheet.disabled = true;
    refs.log.innerHTML = '';
    refs.bar.style.width = '0%';
    try {
      setStep(refs.steps, 0);
      const locs = prepare();
      log(`▸ Read locales.csv — ${locs.length} target locales`);
      await wait(300);
      setStep(refs.steps, 1);
      for (const item of labels) {
        const s = item.loc.strings.descriptor;
        const grow = Math.round(((s.length - MASTER.descriptor.length) / MASTER.descriptor.length) * 100);
        if (item.missing) log(`  ${item.loc.code.padEnd(6)} ⚠ not in translation memory, kept EN (needs LLM call)`, 'warn');
        else log(`  ${item.loc.code.padEnd(6)} ${s}  (${grow >= 0 ? '+' : ''}${grow}% chars)`);
        await wait(35);
      }
      setStep(refs.steps, 2);
      log('▸ Fitting copy to vector text frames…');
      await wait(200);
      const { ms, overflows, adjusted } = renderLabels();
      log(refs.autofit.checked ? `  ${adjusted} labels re-kerned / resized in ${ms} ms, ${overflows} overflow(s)` : `  auto-fit disabled — ${overflows} frame(s) overflow`, overflows ? 'warn' : 'ok');
      setStep(refs.steps, 3);
      log(`▸ Exported ${labels.length} labels (${LW}×${LH} px)`);
      await wait(250);
      setStep(refs.steps, 4);
      log('▸ Batch rendering 3D product shots…');
      const secs = await batchRender();
      log(`  ${labels.length} renders in ${secs} s`, 'ok');
      setStep(refs.steps, 5);
      refs.sheet.disabled = false;
    } finally {
      running = false;
      refs.run.disabled = false;
    }
  }

  function contactSheet() {
    const cols = 5;
    const W = 300;
    const H = 380;
    const cap = 34;
    const rows = Math.ceil(renders.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * W;
    c.height = rows * (H + cap);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, c.width, c.height);
    return Promise.all(
      renders.map(
        (rd, i) =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => {
              const x = (i % cols) * W;
              const y = Math.floor(i / cols) * (H + cap);
              ctx.drawImage(img, x, y, W, H);
              ctx.fillStyle = '#e8ecf3';
              ctx.font = `600 16px ${BODY}`;
              ctx.fillText(`${rd.loc.code} · ${rd.loc.language}`, x + 12, y + H + 22);
              res();
            };
            img.src = rd.url;
          })
      )
    ).then(() => c.toDataURL('image/png'));
  }

  refs.run.addEventListener('click', run);
  refs.autofit.addEventListener('change', () => {
    if (labels.length) renderLabels();
  });
  refs.csv.addEventListener('input', () => {
    refs.csvCount.textContent = `${parseCsv(refs.csv.value).length} locales`;
  });
  refs.sheet.addEventListener('click', async () => downloadDataUrl(await contactSheet(), 'aura-contact-sheet.png'));
  refs.labelPng.addEventListener('click', () => {
    const src = selected ? selected.canvas : refs.master;
    downloadDataUrl(src.toDataURL('image/png'), `aura-label-${selected ? selected.loc.code : 'en'}.png`);
  });

  const paintMaster = () => {
    masterFit = drawLabel(refs.master, masterLoc, true);
    masterTex.needsUpdate = true;
    if (labels.length) renderLabels();
  };
  prepare();
  paintMaster();
  renderLabels();
  document.fonts?.ready.then(paintMaster);

  return { activate: () => stage.start(), deactivate: () => stage.stop() };
}
