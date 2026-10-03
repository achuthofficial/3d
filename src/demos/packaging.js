// Demo 01 — Automated packaging pipeline: 2D dieline → folded 3D box → AI-themed scene.
import * as THREE from 'three';
import { createStage, gradientTexture, softSprite, disposeTree } from '../lib/stage.js';
import { mountTemplate, setStep, tween, downloadDataUrl, debounce, wait, escapeHtml } from '../lib/dom.js';
import { hashString, mulberry32 } from '../lib/noise.js';
import { mixHex, luminance, hslToHex } from '../lib/color.js';

const FORMATS = {
  cereal: { W: 1.5, H: 2.1, D: 0.55, weight: 'NET WT 500 g' },
  tea: { W: 1.6, H: 1.0, D: 0.9, weight: '20 TEA BAGS · 40 g' },
  cube: { W: 1.3, H: 1.3, D: 1.3, weight: 'LIMITED EDITION' },
};
const PX = 320; // texture pixels per scene unit
const HEADING = '"Space Grotesk", "Inter", system-ui, sans-serif';
const BODY = '"Inter", system-ui, sans-serif';

const THEMES = [
  { id: 'citrus', name: 'Sunlit citrus', words: ['citrus', 'lemon', 'orange', 'sun', 'sunny', 'summer', 'tropical', 'mango', 'breakfast', 'morning', 'juice', 'fresh', 'bright', 'granola'], sky: ['#fff1c2', '#ffbf69'], ground: '#f1d39c', key: '#fff0cc', keyI: 3.2, rim: '#ffb347', fog: '#ffd597', particles: { type: 'bokeh', color: '#fff6d8', count: 60 }, props: 'fruit', propColors: ['#ff9f1c', '#ffd23f', '#f77f00'] },
  { id: 'forest', name: 'Forest floor', words: ['forest', 'green', 'leaf', 'leaves', 'moss', 'nature', 'natural', 'organic', 'herbal', 'tea', 'matcha', 'earth', 'woods', 'botanical', 'garden', 'vegan'], sky: ['#e2f0df', '#7fa37f'], ground: '#62804f', key: '#fff3da', keyI: 2.8, rim: '#c4eaa8', fog: '#a9c4a2', particles: { type: 'leaves', color: '#a3d16f', count: 70 }, props: 'stones', propColors: ['#8a8f86', '#6f756b', '#a3a89c'] },
  { id: 'ocean', name: 'Coastal breeze', words: ['ocean', 'sea', 'beach', 'wave', 'waves', 'aqua', 'marine', 'coast', 'coastal', 'water', 'surf', 'island', 'blue', 'salt'], sky: ['#dcf4ff', '#6cc3e8'], ground: '#efe2c4', key: '#ffffff', keyI: 3, rim: '#9be7ff', fog: '#c4e9f7', particles: { type: 'bokeh', color: '#e8fbff', count: 50 }, props: 'stones', propColors: ['#ffffff', '#f2e3c4', '#9ad1e6'] },
  { id: 'neon', name: 'Neon night', words: ['neon', 'cyber', 'cyberpunk', 'night', 'synth', 'synthwave', 'club', 'electric', 'future', 'futuristic', 'tech', 'gaming', 'arcade', 'city', 'energy'], sky: ['#090018', '#3b0a6b'], ground: '#160b2e', key: '#ff7ae0', keyI: 2.4, rim: '#00e5ff', fog: '#2a0a4a', particles: { type: 'stars', color: '#8ff7ff', count: 180 }, props: 'rings', propColors: ['#ff4fd8', '#00e5ff', '#7b5cff'] },
  { id: 'luxury', name: 'Velvet luxury', words: ['luxury', 'gold', 'golden', 'premium', 'elegant', 'velvet', 'noir', 'black', 'classic', 'rich', 'chocolate', 'jewel', 'marble', 'perfume'], sky: ['#18130e', '#3a2c1c'], ground: '#211912', key: '#ffd9a0', keyI: 3.2, rim: '#e0b84a', fog: '#2a2016', particles: { type: 'dust', color: '#ffd27a', count: 120 }, props: 'pedestals', propColors: ['#2c2219', '#c9a227', '#3d2f22'] },
  { id: 'winter', name: 'Winter frost', words: ['winter', 'snow', 'ice', 'frost', 'frozen', 'cold', 'christmas', 'holiday', 'mint', 'cool', 'arctic', 'alpine'], sky: ['#f1f7ff', '#b4cbe8'], ground: '#f4f8fd', key: '#eef4ff', keyI: 2.8, rim: '#bfe0ff', fog: '#dce9f8', particles: { type: 'snow', color: '#ffffff', count: 240 }, props: 'ice', propColors: ['#dff1ff', '#bfe3ff', '#ffffff'] },
  { id: 'desert', name: 'Warm desert', words: ['desert', 'sand', 'dune', 'terracotta', 'warm', 'spice', 'spicy', 'canyon', 'clay', 'coffee', 'autumn', 'sunset', 'cinnamon', 'rustic', 'bakery'], sky: ['#ffd7b0', '#d9774a'], ground: '#d9a273', key: '#ffc58a', keyI: 3.2, rim: '#ff8c5a', fog: '#e8a77c', particles: { type: 'dust', color: '#ffe0b8', count: 90 }, props: 'pots', propColors: ['#c4643b', '#a24d2c', '#e3a26f'] },
  { id: 'candy', name: 'Candy pop', words: ['candy', 'sweet', 'pastel', 'pink', 'kids', 'fun', 'bubblegum', 'party', 'berry', 'dessert', 'playful', 'cute', 'strawberry', 'toy'], sky: ['#ffe0f0', '#c8b2ff'], ground: '#ffe6f2', key: '#fff4fb', keyI: 2.8, rim: '#b28bff', fog: '#f2d3f5', particles: { type: 'confetti', color: '#ffffff', count: 140 }, props: 'spheres', propColors: ['#ff8fc7', '#8fd3ff', '#ffe36e', '#b28bff'] },
  { id: 'studio', name: 'Clean studio', words: ['studio', 'minimal', 'minimalist', 'clean', 'white', 'simple', 'product', 'neutral', 'modern', 'scandi'], sky: ['#f4f4f6', '#d0d2d8'], ground: '#e8e9ec', key: '#ffffff', keyI: 3, rim: '#ffffff', fog: '#dfe0e4', particles: { type: 'none' }, props: 'blocks', propColors: ['#ffffff', '#e2e3e7', '#cfd1d6'] },
];

const PROMPTS = ['sunny citrus breakfast table, morning light', 'neon cyberpunk city at night', 'luxury black marble with gold', 'misty forest floor, organic', 'pastel candy party'];

// ---------------------------------------------------------------------------
// 2D artwork
// ---------------------------------------------------------------------------

function fitFont(ctx, text, maxW, maxSize, weight, family) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size = Math.max(6, (size * maxW) / w);
  return size;
}

function drawPattern(ctx, kind, w, h, light) {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = light;
  ctx.strokeStyle = light;
  if (kind === 'Rays') {
    const cx = w / 2;
    const cy = h * 0.34;
    const R = Math.hypot(w, h);
    for (let i = 0; i < 24; i += 2) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
      ctx.fill();
    }
  } else if (kind === 'Dots') {
    const s = 26;
    for (let y = 0; y < h + s; y += s) {
      for (let x = (y / s) % 2 ? s / 2 : 0; x < w + s; x += s) {
        ctx.beginPath();
        ctx.arc(x, y, 4 + 3 * (y / h), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (kind === 'Waves') {
    ctx.lineWidth = 5;
    for (let y = -20; y < h + 40; y += 30) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x / 28 + y) * 9);
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 8, y - 8, w + 16, h + 26);
  ctx.fillStyle = '#111';
  let cx = x;
  while (cx < x + w) {
    const bw = 1 + Math.floor(rand() * 3) * 1.5;
    if (rand() > 0.42) ctx.fillRect(cx, y, bw, h);
    cx += bw + 1;
  }
  ctx.font = `500 11px ${BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(5000000000000 + (seed % 999999999)).slice(0, 13), x + w / 2, y + h + 13);
}

function drawPanel(ctx, kind, w, h, d) {
  const base = d.color;
  const light = mixHex(base, '#ffffff', 0.82);
  const ink = luminance(base) > 0.42 ? '#1b1b1f' : '#ffffff';
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, mixHex(base, '#ffffff', 0.14));
  g.addColorStop(1, mixHex(base, '#000000', 0.28));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  drawPattern(ctx, d.pattern, w, h, light);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  if (kind === 'front') {
    const r = Math.min(w * 0.24, h * 0.2);
    const cy = h * 0.31;
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(w / 2, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = base;
    ctx.font = `700 ${r * 1.15}px ${HEADING}`;
    ctx.fillText(d.brand.charAt(0) || '·', w / 2, cy + r * 0.05);
    ctx.fillStyle = ink;
    const bs = fitFont(ctx, d.brand, w * 0.86, h * 0.15, 700, HEADING);
    ctx.font = `700 ${bs}px ${HEADING}`;
    ctx.fillText(d.brand, w / 2, h * 0.6);
    const ts = fitFont(ctx, d.tagline, w * 0.8, h * 0.048, 500, BODY);
    ctx.font = `500 ${ts}px ${BODY}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(d.tagline, w / 2, h * 0.6 + bs * 0.75);
    ctx.globalAlpha = 1;
    ctx.fillStyle = light;
    ctx.fillRect(0, h * 0.85, w, h * 0.09);
    ctx.fillStyle = base;
    ctx.font = `700 ${Math.min(h * 0.04, w * 0.06)}px ${BODY}`;
    ctx.fillText(d.weight, w / 2, h * 0.895);
    // starburst badge
    const bx = w * 0.84;
    const by = h * 0.1;
    const br = Math.min(w, h) * 0.09;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = i % 2 ? br * 0.78 : br;
      ctx.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
    }
    ctx.fill();
    ctx.fillStyle = base;
    ctx.font = `800 ${br * 0.5}px ${HEADING}`;
    ctx.fillText('NEW', bx, by + 1);
  } else if (kind === 'back') {
    ctx.fillStyle = ink;
    const bs = fitFont(ctx, d.brand, w * 0.6, h * 0.07, 700, HEADING);
    ctx.font = `700 ${bs}px ${HEADING}`;
    ctx.fillText(d.brand, w / 2, h * 0.09);
    const bx = w * 0.12;
    const bw = w * 0.76;
    const by = h * 0.17;
    const rows = [['Energy', '380 kcal'], ['Fat', '6 g'], ['Carbohydrate', '68 g'], ['of which sugars', '12 g'], ['Fibre', '9 g'], ['Protein', '11 g'], ['Salt', '0.1 g']];
    const rh = Math.min(h * 0.045, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, bw, rh * (rows.length + 1.6));
    ctx.fillStyle = '#111';
    ctx.textAlign = 'left';
    ctx.font = `800 ${rh * 0.62}px ${BODY}`;
    ctx.fillText('Nutrition · per 100 g', bx + 10, by + rh * 0.7);
    ctx.font = `500 ${rh * 0.5}px ${BODY}`;
    rows.forEach(([k, v], i) => {
      const y = by + rh * (i + 1.7);
      ctx.fillStyle = '#ddd';
      ctx.fillRect(bx + 8, y - rh * 0.5, bw - 16, 1);
      ctx.fillStyle = '#111';
      ctx.textAlign = 'left';
      ctx.fillText(k, bx + 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(v, bx + bw - 10, y);
    });
    ctx.textAlign = 'center';
    drawBarcode(ctx, w * 0.56, h * 0.78, w * 0.3, h * 0.08, hashString(d.brand));
    ctx.fillStyle = ink;
    ctx.font = `500 ${Math.min(13, w * 0.03)}px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.fillText('Artwork mapped automatically', w * 0.1, h * 0.8);
    ctx.fillText('from the Illustrator dieline.', w * 0.1, h * 0.8 + 16);
    ctx.textAlign = 'center';
  } else if (kind === 'left' || kind === 'right') {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = ink;
    const bs = fitFont(ctx, d.brand, h * 0.8, w * 0.42, 700, HEADING);
    ctx.font = `700 ${bs}px ${HEADING}`;
    ctx.fillText(d.brand, 0, kind === 'left' ? -bs * 0.15 : -bs * 0.15);
    const ts = fitFont(ctx, d.tagline, h * 0.7, w * 0.11, 500, BODY);
    ctx.font = `500 ${ts}px ${BODY}`;
    ctx.fillText(kind === 'left' ? d.tagline : 'Best before: see top flap', 0, bs * 0.62);
    ctx.restore();
  } else if (kind === 'top') {
    ctx.fillStyle = ink;
    const bs = fitFont(ctx, d.brand, w * 0.6, h * 0.36, 700, HEADING);
    ctx.font = `700 ${bs}px ${HEADING}`;
    ctx.fillText(d.brand, w / 2, h * 0.42);
    ctx.font = `700 ${Math.min(h * 0.12, 18)}px ${BODY}`;
    ctx.fillText('OPEN HERE  ▸', w / 2, h * 0.75);
  } else {
    ctx.fillStyle = ink;
    ctx.font = `600 ${Math.min(h * 0.11, 16)}px ${BODY}`;
    ctx.fillText('LOT 2026-10 · Printed on recycled board', w / 2, h * 0.45);
    ctx.fillText('♻  Please recycle', w / 2, h * 0.65);
  }
}

function panelSizes(f) {
  return {
    front: [f.W, f.H],
    back: [f.W, f.H],
    left: [f.D, f.H],
    right: [f.D, f.H],
    top: [f.W, f.D],
    bottom: [f.W, f.D],
  };
}

function drawDieline(canvas, f, panelCanvases) {
  const { W, H, D } = f;
  const glue = 0.22;
  const dust = D * 0.5;
  const ins = Math.min(D * 0.12, 0.08);
  const gIns = 0.1;
  const unitsW = 2 * D + 2 * W + glue;
  const unitsH = H + 2 * D;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 360;
  const pad = 14;
  const s = (cssW - pad * 2) / unitsW;
  const cssH = unitsH * s + pad * 2;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const X = (u) => pad + u * s;
  const Y = (v) => pad + v * s;

  const outline = [
    [D, 0], [D + W, 0], [D + W, D], [D + W + ins, D - dust], [2 * D + W - ins, D - dust], [2 * D + W, D],
    [2 * D + 2 * W, D], [2 * D + 2 * W + glue, D + gIns], [2 * D + 2 * W + glue, D + H - gIns], [2 * D + 2 * W, D + H],
    [2 * D + W, D + H], [2 * D + W - ins, D + H + dust], [D + W + ins, D + H + dust], [D + W, D + H],
    [D + W, 2 * D + H], [D, 2 * D + H], [D, D + H], [D - ins, D + H + dust], [ins, D + H + dust], [0, D + H],
    [0, D], [ins, D - dust], [D - ins, D - dust], [D, D],
  ];
  ctx.beginPath();
  outline.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
  ctx.closePath();
  ctx.fillStyle = '#e8dcc3';
  ctx.fill();

  const place = {
    left: [0, D, D, H],
    front: [D, D, W, H],
    right: [D + W, D, D, H],
    back: [2 * D + W, D, W, H],
    top: [D, 0, W, D],
    bottom: [D, D + H, W, D],
  };
  for (const [k, [u, v, pw, ph]] of Object.entries(place)) {
    ctx.drawImage(panelCanvases[k], X(u), Y(v), pw * s, ph * s);
  }
  // glue hatch
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(2 * D + 2 * W), Y(D), glue * s, H * s);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,100,70,0.45)';
  ctx.lineWidth = 1;
  for (let i = -20; i < 80; i++) {
    ctx.beginPath();
    ctx.moveTo(X(2 * D + 2 * W), Y(D) + i * 6);
    ctx.lineTo(X(2 * D + 2 * W) + glue * s, Y(D) + i * 6 - glue * s);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  outline.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
  ctx.closePath();
  ctx.strokeStyle = '#ff2d55';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const folds = [
    [[D, D], [D, D + H]], [[D + W, D], [D + W, D + H]], [[2 * D + W, D], [2 * D + W, D + H]], [[2 * D + 2 * W, D], [2 * D + 2 * W, D + H]],
    [[D, D], [D + W, D]], [[D, D + H], [D + W, D + H]], [[0, D], [D, D]], [[D + W, D], [2 * D + W, D]], [[0, D + H], [D, D + H]], [[D + W, D + H], [2 * D + W, D + H]],
  ];
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#00c2ff';
  ctx.lineWidth = 1.4;
  for (const [[u0, v0], [u1, v1]] of folds) {
    ctx.beginPath();
    ctx.moveTo(X(u0), Y(v0));
    ctx.lineTo(X(u1), Y(v1));
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// 3D box with hinged panels
// ---------------------------------------------------------------------------

function buildBox(f, textures) {
  const { W, H, D } = f;
  const t = 0.014;
  const inside = new THREE.MeshStandardMaterial({ color: 0xdcc9a4, roughness: 0.95 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xcdb78f, roughness: 0.9 });
  const panel = (w, h, tex) => {
    const art = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [edge, edge, edge, edge, art, inside]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const assembly = new THREE.Group();
  const front = new THREE.Group();
  assembly.add(front);
  const frontMesh = panel(W, H, textures.front);
  frontMesh.position.z = -t / 2;
  front.add(frontMesh);

  const hinge = (parent, pos, mesh, meshPos) => {
    const pivot = new THREE.Group();
    pivot.position.set(...pos);
    mesh.position.set(...meshPos);
    pivot.add(mesh);
    parent.add(pivot);
    return pivot;
  };
  const left = hinge(front, [-W / 2, 0, 0], panel(D, H, textures.left), [-D / 2, 0, -t / 2]);
  const right = hinge(front, [W / 2, 0, 0], panel(D, H, textures.right), [D / 2, 0, -t / 2]);
  const back = hinge(right, [D, 0, 0], panel(W, H, textures.back), [W / 2, 0, -t / 2]);
  const top = hinge(front, [0, H / 2, 0], panel(W, D, textures.top), [0, D / 2, -t / 2]);
  const bottom = hinge(front, [0, -H / 2, 0], panel(W, D, textures.bottom), [0, -D / 2, -t / 2]);

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  function setFold(p) {
    const a1 = ease(clamp01(p / 0.45)) * (Math.PI / 2);
    const a2 = ease(clamp01((p - 0.3) / 0.4)) * (Math.PI / 2);
    const a3 = ease(clamp01((p - 0.6) / 0.4)) * (Math.PI / 2);
    left.rotation.y = -a1;
    right.rotation.y = a1;
    back.rotation.y = a2;
    top.rotation.x = -a3;
    bottom.rotation.x = a3;
    front.position.x = -W / 2 * (1 - p);
    front.position.z = (D / 2) * p;
    assembly.position.y = H / 2 + 0.002 + (D + 0.08) * (1 - p);
  }
  setFold(0);
  return { group: assembly, setFold };
}

// ---------------------------------------------------------------------------
// "AI" scene generation (local stand-in for an image-generation API)
// ---------------------------------------------------------------------------

function interpretPrompt(prompt) {
  const tokens = (prompt.toLowerCase().match(/[a-z]+/g) || []).filter((t) => t.length > 2);
  const scored = THEMES.map((th) => {
    const hits = tokens.filter((tok) => th.words.some((w) => tok === w || (tok.length > 3 && (tok.startsWith(w) || w.startsWith(tok)))));
    return { th, hits, score: hits.length };
  }).sort((a, b) => b.score - a.score);
  const total = scored.reduce((s, x) => s + x.score, 0);
  if (!total) {
    const hue = hashString(prompt) % 360;
    const th = {
      id: 'custom', name: 'Generated palette', sky: [hslToHex(hue, 60, 92), hslToHex(hue + 20, 45, 62)], ground: hslToHex(hue, 30, 78),
      key: '#ffffff', keyI: 3, rim: hslToHex(hue + 180, 70, 70), fog: hslToHex(hue + 10, 40, 80),
      particles: { type: 'bokeh', color: '#ffffff', count: 50 }, props: 'spheres', propColors: [hslToHex(hue, 60, 60), hslToHex(hue + 40, 60, 70), hslToHex(hue - 40, 50, 55)],
    };
    return { theme: th, primary: { th, hits: [], conf: 1 }, secondary: null, tokens };
  }
  const primary = scored[0];
  const secondary = scored[1].score ? scored[1] : null;
  const theme = { ...primary.th };
  if (secondary) {
    const k = 0.28;
    theme.sky = [mixHex(theme.sky[0], secondary.th.sky[0], k), mixHex(theme.sky[1], secondary.th.sky[1], k)];
    theme.fog = mixHex(theme.fog, secondary.th.fog, k);
    theme.rim = mixHex(theme.rim, secondary.th.rim, 0.4);
  }
  return {
    theme,
    primary: { th: primary.th, hits: primary.hits, conf: primary.score / total },
    secondary: secondary && { th: secondary.th, hits: secondary.hits, conf: secondary.score / total },
    tokens,
  };
}

function makeProps(theme, rand) {
  const group = new THREE.Group();
  const col = () => theme.propColors[Math.floor(rand() * theme.propColors.length)];
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.98 + rand() * 1.04);
    const r = 1.9 + rand() * 2.6;
    spots.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  spots.push([-2.1 - rand() * 0.6, 0.9 + rand() * 0.5], [2.2 + rand() * 0.6, 0.7 + rand() * 0.6]);
  const add = (mesh, x, z) => {
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const [x, z] of spots) {
    const s = 0.6 + rand() * 0.7;
    let m;
    switch (theme.props) {
      case 'fruit': {
        if (rand() < 0.3) {
          // citrus slice: peel-coloured rim, pale flesh on the caps
          const flesh = new THREE.MeshStandardMaterial({ color: '#ffe8a3', roughness: 0.55 });
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.26 * s, 0.07, 40), [new THREE.MeshStandardMaterial({ color: col(), roughness: 0.5 }), flesh, flesh]);
          m.position.y = 0.035;
        } else {
          m = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 40, 28), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.55 }));
          m.position.y = 0.24 * s * 0.92;
          m.scale.y = 0.92;
        }
        break;
      }
      case 'stones': {
        m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * s, 1), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.92, flatShading: true }));
        m.scale.set(1.2, 0.5, 1);
        m.rotation.y = rand() * 6;
        m.position.y = 0.12 * s;
        break;
      }
      case 'rings': {
        const c = col();
        m = new THREE.Mesh(new THREE.TorusGeometry(0.5 * s, 0.03, 16, 80), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2 }));
        m.position.y = 0.5 * s + 0.05;
        m.rotation.y = rand() * Math.PI;
        break;
      }
      case 'pedestals': {
        const h = 0.4 + rand() * 1.4;
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, h, 48), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.25, metalness: rand() < 0.4 ? 1 : 0.1 }));
        m.position.y = h / 2;
        break;
      }
      case 'ice': {
        m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 * s, 0), new THREE.MeshPhysicalMaterial({ color: col(), roughness: 0.05, transmission: 0.9, thickness: 0.4, flatShading: true }));
        m.position.y = 0.2 * s;
        m.rotation.set(rand(), rand(), rand());
        break;
      }
      case 'pots': {
        const pts = [];
        const hh = 0.5 + rand() * 0.6;
        for (let i = 0; i <= 12; i++) {
          const v = i / 12;
          pts.push(new THREE.Vector2(0.12 + 0.2 * Math.sin(v * Math.PI * 0.95) + (v > 0.85 ? 0.04 : 0), v * hh));
        }
        m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.85, side: THREE.DoubleSide }));
        m.scale.setScalar(s);
        break;
      }
      case 'spheres': {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 40, 28), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.3 }));
        m.position.y = 0.22 * s;
        break;
      }
      default: {
        const h = 0.25 + rand() * 0.9;
        m = rand() < 0.5
          ? new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, h, 0.5 * s), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.7 }))
          : new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.25 * s, h, 48), new THREE.MeshStandardMaterial({ color: col(), roughness: 0.7 }));
        m.position.y = h / 2;
        m.rotation.y = rand() * Math.PI;
      }
    }
    add(m, x, z);
  }
  return group;
}

function makeParticles(theme, rand, sprite) {
  const p = theme.particles;
  if (!p || p.type === 'none') return null;
  const n = p.count;
  const pos = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  const confetti = ['#ff6fb5', '#6fd0ff', '#ffe066', '#9f7bff', '#7dffb0'];
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rand() - 0.5) * 12;
    pos[i * 3 + 1] = rand() * 5;
    pos[i * 3 + 2] = -6 + rand() * 9;
    seeds[i] = rand() * 100;
    tmp.set(p.type === 'confetti' ? confetti[i % confetti.length] : p.color);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const size = { bokeh: 0.38, snow: 0.07, leaves: 0.1, stars: 0.05, dust: 0.045, confetti: 0.08 }[p.type] ?? 0.08;
  const mat = new THREE.PointsMaterial({
    size,
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: p.type === 'bokeh' ? 0.45 : 0.9,
    depthWrite: false,
    blending: p.type === 'bokeh' || p.type === 'stars' || p.type === 'dust' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.update = (dt, t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      if (p.type === 'snow' || p.type === 'leaves' || p.type === 'confetti') {
        a[i * 3 + 1] -= dt * (p.type === 'snow' ? 0.35 : 0.5) * (0.6 + (s % 1));
        a[i * 3] += Math.sin(t * 1.3 + s) * dt * 0.25;
        if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 5;
      } else if (p.type === 'bokeh' || p.type === 'dust') {
        a[i * 3 + 1] += dt * 0.08 * (0.5 + (s % 1));
        a[i * 3] += Math.sin(t * 0.4 + s) * dt * 0.05;
        if (a[i * 3 + 1] > 5) a[i * 3 + 1] = 0;
      }
    }
    if (p.type === 'stars') mat.opacity = 0.7 + Math.sin(t * 2) * 0.2;
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}

// ---------------------------------------------------------------------------

export async function mount(root) {
  const refs = mountTemplate(
    root,
    `
  <div class="demo">
    <div class="demo-main">
      <div class="viewport" data-ref="stage">
        <div class="viewport-badge" data-ref="status">Flat dieline · ready</div>
        <div class="viewport-hint">Drag to orbit · scroll to zoom</div>
        <div class="viewport-shimmer" data-ref="shimmer"><span>Generating scene…</span></div>
      </div>
      <ol class="steps" data-ref="steps">
        <li>Dieline art</li><li>UV map</li><li>Fold</li><li>AI scene</li><li>Composite</li>
      </ol>
    </div>
    <div class="demo-side">
      <div class="mini-card">
        <div class="mini-card-head"><span>Illustrator artboard · dieline</span><span data-ref="dims"></span></div>
        <canvas class="dieline" data-ref="dieline"></canvas>
        <div class="legend"><span><i class="lg lg-cut"></i>Cut</span><span><i class="lg lg-fold"></i>Fold</span><span><i class="lg lg-glue"></i>Glue</span></div>
      </div>
      <div class="field-grid">
        <label class="field"><span>Brand</span><input data-ref="brand" value="SUNBURST" maxlength="14" /></label>
        <label class="field"><span>Brand colour</span><input type="color" data-ref="color" value="#f26b1d" /></label>
        <label class="field field-wide"><span>Tagline</span><input data-ref="tagline" value="Cold-pressed citrus granola" maxlength="40" /></label>
        <label class="field"><span>Pattern</span><select data-ref="pattern"><option>Rays</option><option>Dots</option><option>Waves</option><option>Grid</option></select></label>
        <label class="field"><span>Format</span><select data-ref="format"><option value="cereal">Cereal box</option><option value="tea">Tea carton</option><option value="cube">Gift cube</option></select></label>
        <label class="field field-wide"><span>Scene prompt (AI background)</span><input data-ref="prompt" value="${PROMPTS[0]}" /></label>
      </div>
      <div class="chips" data-ref="chips">${PROMPTS.map((p) => `<button class="chip" type="button">${escapeHtml(p)}</button>`).join('')}</div>
      <label class="field"><span>Fold <output data-ref="foldOut">0%</output></span><input type="range" data-ref="fold" min="0" max="100" value="0" /></label>
      <div class="btn-row">
        <button class="btn btn-primary" data-ref="run" type="button">Run one-click pipeline</button>
        <button class="btn" data-ref="scene" type="button">Regenerate scene</button>
        <button class="btn" data-ref="export" type="button">Export PNG</button>
      </div>
    </div>
    <div class="demo-foot">
      <div class="ai-card" data-ref="ai"><span class="muted">The AI interpretation of your scene prompt appears here after the pipeline runs.</span></div>
    </div>
  </div>`
  );

  const stage = createStage(refs.stage, { camera: [0, 2.0, 8.6], target: [0, 1.3, 0], background: 0x1a1c22, maxDistance: 16 });
  const { scene } = stage;
  const sprite = softSprite();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(3, 4, -6);
  scene.add(hemi, key, rim);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let format = FORMATS.cereal;
  let canvases = {};
  let textures = {};
  let box = null;
  let foldValue = 0;
  let props = null;
  let particles = null;
  let busy = false;

  const design = () => ({
    brand: refs.brand.value.trim() || 'BRAND',
    tagline: refs.tagline.value.trim(),
    color: refs.color.value,
    pattern: refs.pattern.value,
    weight: format.weight,
  });

  function paintArtwork() {
    const d = design();
    for (const k of Object.keys(panelSizes(format))) {
      const c = canvases[k];
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawPanel(ctx, k, c.width, c.height, d);
      if (textures[k]) textures[k].needsUpdate = true;
    }
    drawDieline(refs.dieline, format, canvases);
    refs.dims.textContent = `${Math.round(format.W * 100)} × ${Math.round(format.H * 100)} × ${Math.round(format.D * 100)} mm`;
  }

  function rebuild() {
    if (box) {
      scene.remove(box.group);
      disposeTree(box.group);
    }
    canvases = {};
    textures = {};
    for (const [k, [w, h]] of Object.entries(panelSizes(format))) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * PX);
      c.height = Math.round(h * PX);
      canvases[k] = c;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
      textures[k] = tex;
    }
    paintArtwork();
    box = buildBox(format, textures);
    box.setFold(foldValue);
    scene.add(box.group);
  }

  function setFold(v) {
    foldValue = v;
    box.setFold(v);
    refs.fold.value = Math.round(v * 100);
    refs.foldOut.textContent = `${Math.round(v * 100)}%`;
  }

  function applyScene(prompt) {
    const result = interpretPrompt(prompt);
    const th = result.theme;
    const rand = mulberry32(hashString(prompt));
    scene.background?.dispose?.();
    scene.background = gradientTexture(th.sky[0], th.sky[1]);
    scene.fog = new THREE.Fog(th.fog, 10, 30);
    ground.material.color.set(th.ground);
    hemi.color.set(th.sky[0]);
    hemi.groundColor.set(th.ground);
    hemi.intensity = 0.7;
    key.color.set(th.key);
    key.intensity = th.keyI;
    rim.color.set(th.rim);
    rim.intensity = 1.6;
    stage.renderer.toneMappingExposure = 1;
    if (props) {
      scene.remove(props);
      disposeTree(props);
    }
    if (particles) {
      scene.remove(particles);
      particles.geometry.dispose();
      particles.material.dispose();
    }
    props = makeProps(th, rand);
    particles = makeParticles(th, rand, sprite);
    scene.add(props);
    if (particles) scene.add(particles);
    renderInterpretation(result);
  }

  function renderInterpretation(r) {
    const sw = (c) => `<i class="swatch" style="background:${c}"></i>`;
    const tokens = r.tokens.map((t) => {
      const hit = r.primary.hits.includes(t) || r.secondary?.hits.includes(t);
      return `<span class="token${hit ? ' is-hit' : ''}">${escapeHtml(t)}</span>`;
    });
    const themes = [r.primary, r.secondary].filter(Boolean).map((x) => `<b>${x.th.name}</b> ${Math.round(x.conf * 100)}%`).join(' + ');
    refs.ai.innerHTML = `
      <div class="ai-card-grid">
        <div><div class="label">Prompt tokens</div><div class="tokens">${tokens.join('') || '<span class="muted">—</span>'}</div></div>
        <div><div class="label">Interpreted theme</div><div>${themes || '<b>Generated palette</b> (no known keywords — hue derived from prompt)'}</div></div>
        <div><div class="label">Sky · ground · fog</div><div>${sw(r.theme.sky[0])}${sw(r.theme.sky[1])}${sw(r.theme.ground)}${sw(r.theme.fog)}</div></div>
        <div><div class="label">Lighting rig</div><div>${sw(r.theme.key)} key ×${r.theme.keyI} · ${sw(r.theme.rim)} rim · soft shadows</div></div>
        <div><div class="label">Set dressing</div><div>${r.theme.props} · ${r.theme.particles?.type ?? 'none'} atmosphere</div></div>
      </div>
      <p class="fine">Runs locally in your browser as a stand-in for the Stable Diffusion / DALL·E call the production plugin makes. The prompt is parsed into a palette, lighting rig and set dressing, and the box is lit to match the backdrop.</p>`;
  }

  async function runPipeline() {
    if (busy) return;
    busy = true;
    refs.run.disabled = true;
    try {
      if (foldValue > 0) await tween(foldValue, 0, 500, setFold);
      setStep(refs.steps, 0);
      refs.status.textContent = 'Reading dieline artwork…';
      paintArtwork();
      refs.dieline.classList.add('pulse');
      await wait(650);
      refs.dieline.classList.remove('pulse');
      setStep(refs.steps, 1);
      refs.status.textContent = 'UV-mapping 6 panels to 3D…';
      await wait(500);
      setStep(refs.steps, 2);
      refs.status.textContent = 'Folding along crease lines…';
      const cam0 = stage.camera.position.clone();
      const cam1 = new THREE.Vector3(3.6, 2.6, 5.6);
      const tgt0 = stage.controls.target.clone();
      const tgt1 = new THREE.Vector3(0, format.H / 2, -format.D / 2 + 0.2);
      await tween(0, 1, 2000, (v) => {
        setFold(v);
        stage.camera.position.lerpVectors(cam0, cam1, v);
        stage.controls.target.lerpVectors(tgt0, tgt1, v);
      });
      setStep(refs.steps, 3);
      refs.status.textContent = 'Generating background from prompt…';
      refs.shimmer.classList.add('is-on');
      await wait(900);
      applyScene(refs.prompt.value);
      refs.shimmer.classList.remove('is-on');
      setStep(refs.steps, 4);
      refs.status.textContent = 'Matching light, fog and shadows…';
      await wait(500);
      setStep(refs.steps, 5);
      refs.status.textContent = 'Mockup ready · drag to orbit';
    } finally {
      busy = false;
      refs.run.disabled = false;
    }
  }

  // Events
  const repaint = debounce(paintArtwork, 80);
  ['brand', 'tagline', 'color', 'pattern'].forEach((k) => refs[k].addEventListener('input', repaint));
  refs.format.addEventListener('change', () => {
    format = FORMATS[refs.format.value];
    rebuild();
  });
  refs.fold.addEventListener('input', () => {
    setFold(refs.fold.value / 100);
    refs.status.textContent = foldValue >= 1 ? 'Folded' : foldValue > 0 ? 'Folding…' : 'Flat dieline';
  });
  refs.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    refs.prompt.value = b.textContent;
    applyScene(refs.prompt.value);
  });
  refs.prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyScene(refs.prompt.value);
  });
  refs.scene.addEventListener('click', () => applyScene(refs.prompt.value));
  refs.run.addEventListener('click', runPipeline);
  refs.export.addEventListener('click', () => {
    downloadDataUrl(stage.snapshot(), `${design().brand.toLowerCase().replace(/\W+/g, '-')}-mockup.png`);
  });
  const ro = new ResizeObserver(debounce(() => drawDieline(refs.dieline, format, canvases), 100));
  ro.observe(refs.dieline);

  stage.onFrame((dt, t) => particles?.userData.update(dt, t));

  rebuild();
  document.fonts?.ready.then(paintArtwork);

  return {
    activate: () => stage.start(),
    deactivate: () => stage.stop(),
  };
}
