// Demo 05 — Brand consistency QA before a 2D → 3D handoff. Works on the bundled
// sample or on any SVG exported from Illustrator (layers = top-level groups).
import { mountTemplate, wait, downloadText, escapeHtml } from '../lib/dom.js';
import { nearestColor, rgbToHex } from '../lib/color.js';
import { traceContours, simplifyClosed, fitBezier, anchorsToPath, signedArea } from '../lib/trace.js';

const BRAND = {
  name: 'NOVA Coffee Co.',
  palette: [
    { name: 'Nova Ember', hex: '#E63B2E' },
    { name: 'Roast', hex: '#3B2418' },
    { name: 'Crema', hex: '#F5F0E6' },
    { name: 'Midnight', hex: '#14161F' },
    { name: 'Oat', hex: '#D9C3A0' },
  ],
  logoRatio: 3.2,
  ratioTolerance: 0.01,
  clearSpace: 0.5,
  naming: /^(ART|TXT|LOGO|DIE|3D)_[A-Z][A-Za-z0-9]*$/,
};
const WEIGHTS = { logo: 20, clearspace: 15, colors: 25, naming: 20, separation: 20 };
const LAYER_COLORS = ['#4f8cff', '#ff5a5a', '#36c275', '#5ad1ff', '#ff9f1a', '#b36bff', '#ffd23f'];
const SHAPES = 'path, rect, circle, ellipse, polygon, polyline, line, text';
const SVGNS = 'http://www.w3.org/2000/svg';

const letter = {
  N: (x) => `M${x} 58V14h8l16 30V14h8v44h-8L${x + 8} 28v30z`,
  O: (x) => `M${x} 36a16 22 0 1 0 32 0a16 22 0 1 0 -32 0zM${x + 8} 36a8 14 0 1 0 16 0a8 14 0 1 0 -16 0z`,
  V: (x) => `M${x} 14h8.5L${x + 16} 46l7.5-32H${x + 32}L${x + 20} 58h-8z`,
  A: (x) => `M${x} 58L${x + 12} 14h8l12 44h-8.5l-2.5-9h-10l-2.5 9zM${x + 13} 41h6l-3-12z`,
};
const LOGO_PATHS = ['N', 'O', 'V', 'A'].map((c, i) => letter[c](86 + i * 37.47)).join('');

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
  <g id="Layer_1" data-name="Layer 1">
    <rect id="background" width="640" height="400" fill="#F4EFE5"/>
    <path id="wave" d="M0 312C120 282 220 338 340 304S560 276 640 298V400H0Z" fill="#E8412C"/>
    <rect id="dieline" x="12" y="12" width="616" height="376" rx="18" fill="none" stroke="#FF00FF" stroke-width="1.5" stroke-dasharray="8 5"/>
  </g>
  <g id="Group_copy_3" data-name="Group copy 3">
    <g id="logo" data-name="logo" transform="translate(190 56) scale(1.13 1)">
      <circle cx="36" cy="36" r="36" fill="#3B2418"/>
      <path d="M36 12l5.5 18.5L60 36l-18.5 5.5L36 60l-5.5-18.5L12 36l18.5-5.5z" fill="#F5F0E6"/>
      <path d="${LOGO_PATHS}" fill="#3B2418" fill-rule="evenodd"/>
    </g>
  </g>
  <g id="text_final_FINAL" data-name="text final FINAL">
    <text x="320" y="218" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-weight="700" font-size="38" fill="#2E6BFF">Cold Brew · Oat Milk</text>
    <text x="320" y="254" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="500" font-size="17" fill="#3B2418">Slow-steeped for 18 hours</text>
  </g>
  <g id="_Path_" data-name="&lt;Path&gt;">
    <circle id="badge" cx="476" cy="66" r="34" fill="#D9C3A0"/>
    <text x="476" y="72" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="16" fill="#3B2418">NEW</text>
  </g>
  <g id="Layer_5" data-name="Layer 5" display="none"></g>
</svg>`;

// ---------------------------------------------------------------------------

function sanitize(svg) {
  svg.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((n) => n.remove());
  svg.querySelectorAll('*').forEach((n) => {
    [...n.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) n.removeAttribute(a.name);
      if ((name === 'href' || name === 'xlink:href') && !a.value.trim().startsWith('#')) n.removeAttribute(a.name);
    });
  });
}

function parseSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') throw new Error('That file is not a valid SVG.');
  sanitize(svg);
  const node = document.importNode(svg, true);
  if (!node.getAttribute('viewBox')) {
    const w = parseFloat(node.getAttribute('width')) || 600;
    const h = parseFloat(node.getAttribute('height')) || 400;
    node.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  node.removeAttribute('width');
  node.removeAttribute('height');
  // Loose top-level shapes go into their own layer, like Illustrator's default layer.
  const loose = [...node.children].filter((n) => n.matches(SHAPES));
  if (loose.length) {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('data-name', 'Layer 0');
    node.insertBefore(g, node.firstChild);
    loose.forEach((n) => g.append(n));
  }
  return node;
}

const layerName = (g) => g.getAttribute('data-name') || g.getAttribute('inkscape:label') || g.id || 'Layer';
const isHidden = (g) => g.getAttribute('display') === 'none' || g.style.display === 'none' || g.getAttribute('visibility') === 'hidden';

function colorToHex(c) {
  if (!c || c === 'none' || c.startsWith('url')) return null;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(',').map((s) => parseFloat(s));
    if (a === 0) return null;
    return rgbToHex([r, g, b]);
  }
  if (c.startsWith('#')) return rgbToHex(c.length === 4 ? [...c.slice(1)].map((x) => parseInt(x + x, 16)) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  return null;
}

function bboxIn(svg, el) {
  try {
    const b = el.getBBox();
    const m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  } catch {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
}

function roleOf(el, lname) {
  if (el.dataset?.role) return el.dataset.role;
  const parts = [lname];
  for (let n = el; n && n.tagName.toLowerCase() !== 'svg'; n = n.parentElement) parts.push(n.id || '', n.getAttribute('data-name') || '');
  const s = parts.join(' ').toLowerCase();
  if (/die|cutline|crease|bleed|trim/.test(s)) return 'dieline';
  if (/logo|brandmark|wordmark/.test(s)) return 'logo';
  if (el.tagName.toLowerCase() === 'text') return 'text';
  if (/background|\bbg\b/.test(s)) return 'background';
  return 'art';
}

function analyze(svg) {
  const vb = svg.viewBox.baseVal;
  const layers = [...svg.children]
    .filter((n) => n.tagName.toLowerCase() === 'g')
    .map((g) => {
      const name = layerName(g);
      const items = [...g.querySelectorAll(SHAPES)]
        .filter((el) => !el.closest('defs, clipPath, mask, pattern, symbol') && !el.closest('.qa-overlay'))
        .filter((el) => el.tagName.toLowerCase() !== 'tspan')
        .map((el) => {
          const cs = getComputedStyle(el);
          return { el, tag: el.tagName.toLowerCase(), role: roleOf(el, name), bbox: bboxIn(svg, el), fill: colorToHex(cs.fill), stroke: colorToHex(cs.stroke) };
        });
      return { g, name, hidden: isHidden(g), items };
    });
  const logoEl = svg.querySelector('[id*="logo" i]:not(svg), [data-name*="logo" i]:not(svg)');
  return { svg, width: vb.width, height: vb.height, layers, logo: logoEl ? { el: logoEl, bbox: bboxIn(svg, logoEl) } : null };
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function runChecks(doc) {
  const checks = [];
  const all = doc.layers.flatMap((l) => l.items.map((it) => ({ ...it, layer: l })));
  const area = doc.width * doc.height;

  // 1. Logo proportions
  if (!doc.logo) {
    checks.push({ id: 'logo', title: 'Logo proportions', status: 'warn', detail: 'No logo found. Name the logo group "logo" so it can be measured.', marks: [] });
  } else {
    const r = doc.logo.bbox.w / doc.logo.bbox.h;
    const diff = r / BRAND.logoRatio - 1;
    const ok = Math.abs(diff) <= BRAND.ratioTolerance;
    checks.push({
      id: 'logo', title: 'Logo proportions', status: ok ? 'pass' : 'fail',
      detail: ok ? `Lockup ratio ${r.toFixed(2)}:1, within ±1% of ${BRAND.logoRatio}:1.` : `Lockup measures ${r.toFixed(2)}:1 vs ${BRAND.logoRatio}:1. ${diff > 0 ? 'Stretched horizontally' : 'Squashed horizontally'} by ${Math.abs(diff * 100).toFixed(1)}%.`,
      marks: ok ? [] : [doc.logo.bbox], fixable: !ok,
    });
  }

  // 2. Clear space
  if (doc.logo) {
    const b = doc.logo.bbox;
    const pad = b.h * BRAND.clearSpace;
    const zone = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    const intruders = all.filter((it) => !doc.logo.el.contains(it.el) && !['background', 'dieline'].includes(it.role) && it.bbox.w * it.bbox.h < area * 0.3 && intersects(it.bbox, zone) && !it.layer.hidden);
    const groups = [...new Set(intruders.map((it) => it.el.parentElement))];
    checks.push({
      id: 'clearspace', title: 'Logo clear space', status: intruders.length ? 'fail' : 'pass',
      detail: intruders.length ? `${intruders.length} object(s) inside the ${BRAND.clearSpace}× logo-height exclusion zone.` : 'Nothing intrudes on the logo exclusion zone.',
      marks: intruders.length ? [zone, ...intruders.map((i) => i.bbox)] : [], fixable: intruders.length > 0, intruders, zone, groups,
    });
  }

  // 3. Brand colours
  const colors = new Map();
  for (const it of all) {
    if (it.role === 'dieline' || it.layer.hidden) continue;
    for (const c of [it.fill, it.stroke]) {
      if (!c) continue;
      if (!colors.has(c)) colors.set(c, []);
      colors.get(c).push(it);
    }
  }
  const off = [];
  for (const [hex, items] of colors) {
    if (BRAND.palette.some((p) => p.hex === hex)) continue;
    off.push({ hex, items, near: nearestColor(hex, BRAND.palette) });
  }
  const compliant = colors.size ? (colors.size - off.length) / colors.size : 1;
  checks.push({
    id: 'colors', title: 'Brand colours (exact hex)', status: off.length ? 'fail' : 'pass', compliant,
    detail: off.length
      ? off.map((o) => `${o.hex} → ${o.near.name} ${o.near.hex} (ΔE₀₀ ${o.near.dE.toFixed(1)}${o.near.dE > 10 ? ', off-brand' : ', near miss'})`).join('<br>')
      : `${colors.size} colours in use, all exact brand swatches.`,
    marks: off.flatMap((o) => o.items.map((i) => i.bbox)), fixable: off.length > 0, off,
  });

  // 4. Layer naming
  const badNames = doc.layers.filter((l) => !BRAND.naming.test(l.name));
  checks.push({
    id: 'naming', title: 'Layer naming convention', status: badNames.length ? 'fail' : 'pass',
    detail: badNames.length ? `${badNames.length} layer(s) don't match <code>PREFIX_Name</code> (ART, TXT, LOGO, DIE, 3D): ${badNames.map((l) => `“${escapeHtml(l.name)}”`).join(', ')}.` : 'Every layer follows the PREFIX_Name convention.',
    marks: [], fixable: badNames.length > 0,
  });

  // 5. Separation for 3D mapping
  const problems = [];
  const marks = [];
  const dieItems = all.filter((it) => it.role === 'dieline');
  const dieMixed = dieItems.filter((it) => it.layer.items.some((o) => o.role !== 'dieline'));
  if (!dieItems.length) problems.push('no dieline found (name it “dieline”)');
  if (dieMixed.length) {
    problems.push('dieline shares a layer with artwork');
    marks.push(...dieMixed.map((i) => i.bbox));
  }
  const liveText = all.filter((it) => it.tag === 'text' && !it.layer.hidden);
  if (liveText.length) {
    problems.push(`${liveText.length} live text object(s) not outlined`);
    marks.push(...liveText.map((i) => i.bbox));
  }
  const hidden = doc.layers.filter((l) => l.hidden);
  const empty = doc.layers.filter((l) => !l.items.length);
  if (hidden.length) problems.push(`${hidden.length} hidden layer(s)`);
  if (empty.length) problems.push(`${empty.length} empty layer(s)`);
  checks.push({
    id: 'separation', title: 'Separation for 3D mapping', status: problems.length ? 'fail' : 'pass',
    detail: problems.length ? `${problems.join('; ')}.` : 'Dieline isolated, text outlined, no hidden or empty layers.',
    marks, fixable: problems.length > 0, dieMixed, liveText, hidden, empty,
  });

  let score = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.id];
    if (c.id === 'colors') score += w * c.compliant;
    else score += c.status === 'pass' ? w : c.status === 'warn' ? w / 2 : 0;
  }
  return { checks, score: Math.round(score) };
}

// ---------------------------------------------------------------------------
// Fixes

function prependTransform(el, t) {
  el.setAttribute('transform', `${t} ${el.getAttribute('transform') || ''}`.trim());
}

function camel(s) {
  const words = String(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Artwork';
}

function suggestName(layer) {
  const roles = layer.items.map((i) => i.role);
  if (roles.length && roles.every((r) => r === 'dieline')) return 'DIE_Cutline';
  if (roles.includes('logo')) return 'LOGO_Primary';
  if (roles.length && roles.every((r) => r === 'text')) return 'TXT_Copy';
  if (roles.includes('background')) return 'ART_Background';
  const named = layer.items.map((i) => i.el.id).find((id) => id && !/^(path|rect|circle|text|layer)/i.test(id));
  if (named) return `ART_${camel(named)}`;
  const clean = camel(layer.name.replace(/copy|final|layer|group|path|\d+/gi, ' '));
  return `ART_${clean === 'Artwork' ? 'Graphics' : clean}`;
}

/** "Create Outlines": rasterise a simple <text> at 4× and trace it into a compound path. */
function outlineText(svg, textEl) {
  if (textEl.querySelector('tspan[x], tspan[y], textPath')) return false;
  const cs = getComputedStyle(textEl);
  const size = parseFloat(cs.fontSize) || 16;
  const S = 6;
  const pad = 4;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const font = `${cs.fontStyle} ${cs.fontWeight} ${size * S}px ${cs.fontFamily}`;
  ctx.font = font;
  const text = textEl.textContent;
  const w = ctx.measureText(text).width / S;
  const asc = size * 1.05;
  c.width = Math.ceil((w + pad * 2) * S);
  c.height = Math.ceil((size * 1.5 + pad * 2) * S);
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad * S, (pad + asc) * S);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const field = new Float32Array(c.width * c.height);
  for (let i = 0; i < field.length; i++) field[i] = data[i * 4 + 3] / 255;
  const anchor = textEl.getAttribute('text-anchor') || cs.textAnchor || 'start';
  const x0 = parseFloat(textEl.getAttribute('x')) || 0;
  const y0 = parseFloat(textEl.getAttribute('y')) || 0;
  const left = anchor === 'middle' ? x0 - w / 2 : anchor === 'end' ? x0 - w : x0;
  let d = '';
  for (const loop of traceContours(field, c.width, c.height, 0.5)) {
    if (Math.abs(signedArea(loop)) < 2) continue;
    const pts = simplifyClosed(loop, 0.6).map(([px, py]) => [left + px / S - pad, y0 + py / S - pad - asc]);
    if (pts.length < 3) continue;
    d += anchorsToPath(fitBezier(pts, { cornerDeg: 50 }));
  }
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', textEl.getAttribute('fill') || cs.fill);
  path.setAttribute('fill-rule', 'evenodd');
  path.dataset.role = textEl.dataset.role || 'text';
  path.dataset.outlined = text;
  if (textEl.getAttribute('transform')) path.setAttribute('transform', textEl.getAttribute('transform'));
  textEl.replaceWith(path);
  return true;
}

// ---------------------------------------------------------------------------

export async function mount(root) {
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="artboard-wrap">
        <div class="artboard-head"><span data-ref="fileName">NOVA_coldbrew_v7_FINAL2.ai</span><span class="muted">Artboard 1</span></div>
        <div class="artboard" data-ref="artboard"><div class="scanbeam" data-ref="beam"></div></div>
      </div>
      <div class="qa-summary">
        <div class="score" data-ref="score"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="score-track"/><circle cx="60" cy="60" r="52" class="score-fill" data-ref="ring"/></svg><div><b data-ref="scoreNum">–</b><span>handoff score</span></div></div>
        <ul class="checks" data-ref="checks"><li class="muted">Run the QA scan to check this artboard against the brand spec.</li></ul>
      </div>
    </div>
    <div class="demo-side">
      <div class="mini-card">
        <div class="mini-card-head"><span>Brand spec · ${BRAND.name}</span><span>v3.1</span></div>
        <div class="spec-palette">${BRAND.palette.map((p) => `<div><i style="background:${p.hex}"></i><b>${p.name}</b><code>${p.hex}</code></div>`).join('')}</div>
        <ul class="spec-rules">
          <li>Logo lockup ${BRAND.logoRatio}:1 (±1%)</li>
          <li>Clear space ≥ ${BRAND.clearSpace}× logo height</li>
          <li>Layers: <code>ART_ · TXT_ · LOGO_ · DIE_ · 3D_</code></li>
          <li>Dieline isolated · text outlined</li>
        </ul>
      </div>
      <div class="mini-card">
        <div class="mini-card-head"><span>Layers</span><span data-ref="layerCount"></span></div>
        <ul class="layers" data-ref="layers"></ul>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" data-ref="scan" type="button">Run QA scan</button>
        <button class="btn" data-ref="fix" type="button" disabled>Auto-fix all</button>
      </div>
      <div class="btn-row">
        <label class="btn btn-file">Check your own SVG<input type="file" accept=".svg,image/svg+xml" data-ref="file" /></label>
        <button class="btn" data-ref="reset" type="button">Reset sample</button>
        <button class="btn" data-ref="manifest" type="button" disabled>Handoff manifest</button>
      </div>
      <div class="log" data-ref="log" aria-live="polite"></div>
    </div>
  </div>`
  );

  let svg = null;
  let doc = null;
  let result = null;
  let busy = false;

  function load(text, name) {
    svg?.remove();
    svg = parseSvg(text);
    svg.classList.add('art-svg');
    refs.artboard.prepend(svg);
    refs.fileName.textContent = name;
    result = null;
    refs.fix.disabled = true;
    refs.manifest.disabled = true;
    refs.checks.innerHTML = '<li class="muted">Run the QA scan to check this artboard against the brand spec.</li>';
    refs.scoreNum.textContent = '–';
    setRing(0, '');
    refs.log.innerHTML = '';
    doc = analyze(svg);
    renderLayers();
  }

  function setRing(score, cls) {
    const C = 2 * Math.PI * 52;
    refs.ring.style.strokeDasharray = `${C}`;
    refs.ring.style.strokeDashoffset = `${C * (1 - score / 100)}`;
    refs.score.className = `score ${cls}`;
  }

  function log(msg, cls = '') {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.innerHTML = msg;
    refs.log.append(line);
    refs.log.scrollTop = refs.log.scrollHeight;
  }

  function renderLayers(flash = new Set()) {
    const issuesByLayer = new Map();
    if (result) {
      for (const l of doc.layers) {
        let n = 0;
        if (!BRAND.naming.test(l.name)) n++;
        if (l.hidden || !l.items.length) n++;
        issuesByLayer.set(l, n);
      }
    }
    refs.layers.innerHTML = [...doc.layers]
      .reverse()
      .map((l, i) => {
        const idx = doc.layers.length - 1 - i;
        const n = issuesByLayer.get(l) || 0;
        const roles = [...new Set(l.items.map((it) => it.role))].join(', ') || 'empty';
        return `<li class="${flash.has(l.name) ? 'flash' : ''}">
          <span class="eye${l.hidden ? ' off' : ''}" title="${l.hidden ? 'Hidden' : 'Visible'}"></span>
          <i class="layer-color" style="background:${LAYER_COLORS[idx % LAYER_COLORS.length]}"></i>
          <span class="layer-name">${escapeHtml(l.name)}<small>${l.items.length} obj · ${roles}</small></span>
          ${result ? (n ? `<span class="tag tag-bad">${n} issue${n > 1 ? 's' : ''}</span>` : '<span class="tag tag-ok">ok</span>') : ''}
        </li>`;
      })
      .join('');
    refs.layerCount.textContent = `${doc.layers.length} layers`;
  }

  function drawOverlay() {
    svg.querySelector('.qa-overlay')?.remove();
    if (!result) return;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'qa-overlay');
    let n = 0;
    for (const c of result.checks) {
      if (c.status === 'pass' || !c.marks.length) continue;
      n++;
      const cg = document.createElementNS(SVGNS, 'g');
      cg.dataset.check = c.id;
      c.marks.forEach((m, i) => {
        const r = document.createElementNS(SVGNS, 'rect');
        Object.entries({ x: m.x - 3, y: m.y - 3, width: m.w + 6, height: m.h + 6, rx: 4 }).forEach(([k, v]) => r.setAttribute(k, v));
        r.setAttribute('class', i === 0 && c.id === 'clearspace' ? 'qa-zone' : 'qa-box');
        cg.append(r);
      });
      const m = c.marks[0];
      const pin = document.createElementNS(SVGNS, 'g');
      pin.setAttribute('class', 'qa-pin');
      pin.setAttribute('transform', `translate(${Math.max(12, m.x)} ${Math.max(12, m.y)})`);
      pin.innerHTML = `<circle r="11"/><text y="4" text-anchor="middle">${n}</text>`;
      cg.append(pin);
      c.pin = n;
      g.append(cg);
    }
    svg.append(g);
  }

  function renderChecks() {
    refs.checks.innerHTML = result.checks
      .map(
        (c) => `<li class="check is-${c.status}" data-check="${c.id}">
          <span class="check-icon">${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : c.pin ?? '✕'}</span>
          <div><b>${c.title}</b><p>${c.detail}</p></div>
        </li>`
      )
      .join('');
    refs.scoreNum.textContent = result.score;
    setRing(result.score, result.score >= 95 ? 'is-good' : result.score >= 60 ? 'is-mid' : 'is-bad');
    refs.fix.disabled = !result.checks.some((c) => c.fixable);
    refs.manifest.disabled = false;
  }

  async function scan() {
    if (busy || !svg) return;
    busy = true;
    refs.scan.disabled = true;
    svg.querySelector('.qa-overlay')?.remove();
    refs.beam.classList.remove('is-on');
    void refs.beam.offsetWidth;
    refs.beam.classList.add('is-on');
    log('▸ Scanning artboard…');
    await wait(1100);
    refs.beam.classList.remove('is-on');
    doc = analyze(svg);
    const roles = doc.layers.flatMap((l) => l.items.map((i) => i.role));
    const count = (r) => roles.filter((x) => x === r).length;
    log(`  detected ${doc.logo ? 'logo lockup' : 'no logo'} · ${count('text')} text · ${count('dieline')} dieline · ${count('art') + count('background')} art objects`);
    result = runChecks(doc);
    drawOverlay();
    renderChecks();
    renderLayers();
    const fails = result.checks.filter((c) => c.status === 'fail').length;
    log(fails ? `  ${fails} check(s) failed · score ${result.score}/100` : `  all checks passed · score ${result.score}/100`, fails ? 'warn' : 'ok');
    busy = false;
    refs.scan.disabled = false;
  }

  async function autofix() {
    if (busy || !result) return;
    busy = true;
    refs.fix.disabled = true;
    refs.scan.disabled = true;
    svg.querySelector('.qa-overlay')?.remove();
    const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
    const step = async (msg) => {
      log(msg, 'ok');
      await wait(260);
    };

    const sep = byId.separation;
    if (sep?.dieMixed?.length) {
      let die = [...svg.children].find((n) => n.tagName.toLowerCase() === 'g' && /^DIE_/.test(layerName(n)));
      if (!die) {
        die = document.createElementNS(SVGNS, 'g');
        die.setAttribute('data-name', 'DIE_Cutline');
        die.id = 'DIE_Cutline';
        svg.append(die);
      }
      sep.dieMixed.forEach((it) => die.append(it.el));
      await step('✓ Moved dieline to its own <code>DIE_Cutline</code> layer');
    }
    if (sep?.liveText?.length) {
      let n = 0;
      sep.liveText.forEach((it) => {
        if (it.el.isConnected && outlineText(svg, it.el)) n++;
      });
      await step(`✓ Created outlines for ${n} live text object(s)`);
    }
    if (sep?.empty?.length) {
      sep.empty.forEach((l) => l.g.remove());
      await step(`✓ Deleted ${sep.empty.length} empty layer(s)`);
    }
    const stillHidden = (sep?.hidden || []).filter((l) => l.g.isConnected);
    if (stillHidden.length) {
      stillHidden.forEach((l) => {
        l.g.removeAttribute('display');
        l.g.removeAttribute('visibility');
        l.g.style.display = '';
      });
      await step(`✓ Unhid ${stillHidden.length} layer(s) (review before handoff)`);
    }

    doc = analyze(svg);
    if (doc.logo) {
      const b = doc.logo.bbox;
      const k = (BRAND.logoRatio * b.h) / b.w;
      if (Math.abs(k - 1) > BRAND.ratioTolerance / 2) {
        const cx = b.x + b.w / 2;
        prependTransform(doc.logo.el, `translate(${cx} 0) scale(${k.toFixed(5)} 1) translate(${-cx} 0)`);
        await step(`✓ Restored logo lockup to ${BRAND.logoRatio}:1 (scaled width ${(k * 100).toFixed(1)}%)`);
      }
    }

    doc = analyze(svg);
    const cs = runChecks(doc).checks.find((c) => c.id === 'clearspace');
    if (cs && cs.status === 'fail') {
      const z = cs.zone;
      for (const parent of cs.groups) {
        const target = doc.logo.el.contains(parent) ? null : parent;
        if (!target || target === svg) continue;
        const boxes = cs.intruders.filter((i) => i.el.parentElement === parent).map((i) => i.bbox);
        const minX = Math.min(...boxes.map((b) => b.x));
        const maxX = Math.max(...boxes.map((b) => b.x + b.w));
        const right = z.x + z.w + 6 - minX;
        const left = z.x - 6 - maxX;
        const dx = maxX + right <= doc.width - 10 ? right : left;
        // Move the items (not the whole layer) so layer structure stays intact.
        cs.intruders.filter((i) => i.el.parentElement === parent).forEach((i) => prependTransform(i.el, `translate(${dx.toFixed(1)} 0)`));
      }
      await step(`✓ Moved ${cs.intruders.length} object(s) out of the logo clear space`);
    }

    doc = analyze(svg);
    const colorCheck = runChecks(doc).checks.find((c) => c.id === 'colors');
    if (colorCheck?.off?.length) {
      for (const o of colorCheck.off) {
        for (const it of o.items) {
          if (it.fill === o.hex) {
            it.el.setAttribute('fill', o.near.hex);
            it.el.style.fill = '';
          }
          if (it.stroke === o.hex) {
            it.el.setAttribute('stroke', o.near.hex);
            it.el.style.stroke = '';
          }
        }
        await step(`✓ Snapped ${o.hex} → ${o.near.name} ${o.near.hex}${o.near.dE > 10 ? ' <span class="muted">(large shift, flag for designer)</span>' : ''}`);
      }
    }

    doc = analyze(svg);
    const used = new Set();
    const renamed = new Set();
    for (const l of doc.layers) {
      if (BRAND.naming.test(l.name) && !used.has(l.name)) {
        used.add(l.name);
        continue;
      }
      let name = suggestName(l);
      let i = 2;
      while (used.has(name)) name = `${suggestName(l)}${i++}`;
      used.add(name);
      log(`✓ Renamed “${escapeHtml(l.name)}” → <code>${name}</code>`, 'ok');
      l.g.setAttribute('data-name', name);
      l.g.id = name;
      renamed.add(name);
      await wait(160);
    }

    doc = analyze(svg);
    renderLayers(renamed);
    busy = false;
    refs.scan.disabled = false;
    await scan();
  }

  function manifest() {
    doc = analyze(svg);
    const res = runChecks(doc);
    const data = {
      file: refs.fileName.textContent,
      brand: BRAND.name,
      checkedAt: new Date().toISOString(),
      score: res.score,
      readyFor3D: res.checks.every((c) => c.status === 'pass'),
      artboard: { width: doc.width, height: doc.height },
      checks: res.checks.map((c) => ({ id: c.id, title: c.title, status: c.status, detail: c.detail.replace(/<[^>]+>/g, '') })),
      layers: doc.layers.map((l) => ({
        name: l.name,
        hidden: l.hidden,
        roles: [...new Set(l.items.map((i) => i.role))],
        objects: l.items.length,
        colors: [...new Set(l.items.flatMap((i) => [i.fill, i.stroke]).filter(Boolean))],
        uvRegion: l.name.startsWith('DIE_') ? 'cut-path' : l.name.startsWith('LOGO_') ? 'decal' : 'albedo',
      })),
    };
    downloadText(JSON.stringify(data, null, 2), 'handoff-manifest.json', 'application/json');
  }

  refs.checks.addEventListener('mouseover', (e) => {
    const li = e.target.closest('[data-check]');
    svg?.querySelectorAll('.qa-overlay > g').forEach((g) => g.classList.toggle('is-hot', !!li && g.dataset.check === li.dataset.check));
  });
  refs.checks.addEventListener('mouseleave', () => svg?.querySelectorAll('.qa-overlay > g').forEach((g) => g.classList.remove('is-hot')));
  refs.scan.addEventListener('click', scan);
  refs.fix.addEventListener('click', autofix);
  refs.reset.addEventListener('click', () => load(SAMPLE_SVG, 'NOVA_coldbrew_v7_FINAL2.ai'));
  refs.manifest.addEventListener('click', manifest);
  refs.file.addEventListener('change', async () => {
    const f = refs.file.files?.[0];
    if (!f) return;
    try {
      load(await f.text(), f.name);
      log(`▸ Loaded ${escapeHtml(f.name)} · ${doc.layers.length} layer(s)`);
      await scan();
    } catch (err) {
      log(`✕ ${escapeHtml(err.message)}`, 'warn');
    }
    refs.file.value = '';
  });

  load(SAMPLE_SVG, 'NOVA_coldbrew_v7_FINAL2.ai');
  let scannedOnce = false;
  await document.fonts?.ready;

  return {
    activate() {
      if (!scannedOnce) {
        scannedOnce = true;
        doc = analyze(svg);
        renderLayers();
        setTimeout(scan, 400);
      }
    },
    deactivate() {},
  };
}
