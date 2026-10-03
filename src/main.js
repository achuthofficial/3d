import './styles.css';
import { site, projects } from './content.js';
import { escapeHtml } from './lib/dom.js';

const md = (s) => escapeHtml(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

function highlight(src, lang) {
  const py = /python/i.test(lang);
  const re = py
    ? /(#[^\n]*)|("""[\s\S]*?"""|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b(def|return|if|else|for|in|import|from|as|with|class|True|False|None|and|or|not)\b/g
    : /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b(var|let|const|function|return|if|else|for|while|new|async|await|import|from|export|try|catch|throw|true|false|null|continue|break|of|in|typeof)\b/g;
  let out = '';
  let last = 0;
  for (const m of src.matchAll(re)) {
    out += escapeHtml(src.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : 'k';
    out += `<span class="t-${cls}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(src.slice(last));
}

const heroArt = `
<svg class="hero-art" viewBox="-130 -120 260 240" aria-hidden="true">
  <defs>
    <linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb070"/><stop offset="1" stop-color="#ff6a1a"/></linearGradient>
    <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="1" stop-color="#b83d00"/></linearGradient>
    <linearGradient id="hg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fd6ff"/><stop offset="1" stop-color="#1f7fb8"/></linearGradient>
  </defs>
  <g class="hero-grid">${Array.from({ length: 13 }, (_, i) => `<line x1="${-120 + i * 20}" y1="-110" x2="${-120 + i * 20}" y2="110"/><line x1="-120" y1="${-110 + i * 20}" x2="120" y2="${-110 + i * 20}"/>`).join('')}</g>
  <polygon fill="url(#hg1)" points="-30,-80 30,-80 30,-20 -30,-20">
    <animate attributeName="points" dur="6s" repeatCount="indefinite" keyTimes="0;0.25;0.5;0.8;1" calcMode="spline" keySplines="0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1"
      values="-30,-80 30,-80 30,-20 -30,-20;-30,-80 30,-80 30,-20 -30,-20;0,-60 52,-30 0,0 -52,-30;0,-60 52,-30 0,0 -52,-30;-30,-80 30,-80 30,-20 -30,-20"/>
  </polygon>
  <polygon fill="url(#hg2)" points="-70,-10 -10,-10 -10,50 -70,50">
    <animate attributeName="points" dur="6s" repeatCount="indefinite" keyTimes="0;0.25;0.5;0.8;1" calcMode="spline" keySplines="0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1"
      values="-70,-10 -10,-10 -10,50 -70,50;-70,-10 -10,-10 -10,50 -70,50;-52,-30 0,0 0,60 -52,30;-52,-30 0,0 0,60 -52,30;-70,-10 -10,-10 -10,50 -70,50"/>
  </polygon>
  <polygon fill="url(#hg3)" points="10,-10 70,-10 70,50 10,50">
    <animate attributeName="points" dur="6s" repeatCount="indefinite" keyTimes="0;0.25;0.5;0.8;1" calcMode="spline" keySplines="0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1;0.6 0 0.4 1"
      values="10,-10 70,-10 70,50 10,50;10,-10 70,-10 70,50 10,50;0,0 52,-30 52,30 0,60;0,0 52,-30 52,30 0,60;10,-10 70,-10 70,50 10,50"/>
  </polygon>
  <g class="hero-labels"><text x="-118" y="104">2D · vector</text><text x="118" y="104" text-anchor="end">3D · form</text></g>
</svg>`;

const tabButton = (p, i) => `
  <button class="tab" role="tab" id="tab-${p.id}" aria-controls="panel-${p.id}" aria-selected="false" tabindex="${i === 0 ? 0 : -1}" data-id="${p.id}">
    <span class="tab-num">${p.num}</span>
    <span class="tab-text"><b>${escapeHtml(p.tab)}</b><small>${escapeHtml(p.kicker)}</small></span>
  </button>`;

const panel = (p, i) => {
  const prev = projects[i - 1];
  const next = projects[i + 1];
  return `
  <section class="panel" id="panel-${p.id}" role="tabpanel" aria-labelledby="tab-${p.id}" tabindex="-1" hidden>
    <header class="panel-head">
      <div class="panel-num" aria-hidden="true">${p.num}</div>
      <div class="panel-title">
        <p class="eyebrow">Project ${p.num} · ${escapeHtml(p.kicker)}</p>
        <h2>${escapeHtml(p.title)}</h2>
        <p class="lede">${md(p.lede)}</p>
        <ul class="chips-static">${p.stack.map(([n]) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
      </div>
    </header>

    <div class="proto">
      <div class="proto-head"><span class="live-dot" aria-hidden="true"></span><b>Live prototype</b><span class="muted">runs entirely in your browser</span></div>
      <div class="demo-root" data-demo="${p.id}"><div class="demo-loading"><span class="spinner" aria-hidden="true"></span>Loading prototype…</div></div>
      <p class="proto-note"><b>How to use it.</b> ${md(p.prototype)}</p>
    </div>

    <div class="story">
      <article class="story-main">
        <section>
          <h3><span>01</span>The friction</h3>
          <p>${md(p.problem)}</p>
        </section>
        <section>
          <h3><span>02</span>The concept</h3>
          <p>${md(p.concept)}</p>
        </section>
        <section>
          <h3><span>03</span>How it works</h3>
          <ol class="flow">${p.steps.map(([t, d]) => `<li><b>${escapeHtml(t)}</b><p>${md(d)}</p></li>`).join('')}</ol>
        </section>
      </article>
      <aside class="story-side">
        <div class="card card-wow">
          <h4>The “wow” factor</h4>
          <p>${md(p.wow)}</p>
        </div>
        <div class="card">
          <h4>Tech stack</h4>
          <ul class="stack-list">${p.stack.map(([n, why]) => `<li><b>${escapeHtml(n)}</b><span>${escapeHtml(why)}</span></li>`).join('')}</ul>
        </div>
      </aside>
    </div>

    <section class="code">
      <h3><span>04</span>Under the hood</h3>
      <div class="code-card">
        <div class="code-tabs" role="tablist" aria-label="Source files">
          ${p.code.map((c, j) => `<button role="tab" aria-selected="${j === 0}" data-idx="${j}" type="button">${escapeHtml(c.file)}<small>${escapeHtml(c.lang)}</small></button>`).join('')}
        </div>
        ${p.code.map((c, j) => `<pre ${j ? 'hidden' : ''} data-idx="${j}"><code>${highlight(c.src.trimEnd(), c.lang)}</code></pre>`).join('')}
      </div>
    </section>

    <nav class="pager" aria-label="Project navigation">
      ${prev ? `<button class="pager-btn" data-go="${prev.id}" type="button"><small>← Previous</small><b>${prev.num} · ${escapeHtml(prev.tab)}</b></button>` : '<span></span>'}
      ${next ? `<button class="pager-btn next" data-go="${next.id}" type="button"><small>Next →</small><b>${next.num} · ${escapeHtml(next.tab)}</b></button>` : '<span></span>'}
    </nav>
  </section>`;
};

document.getElementById('app').innerHTML = `
  <a class="skip" href="#projects">Skip to projects</a>
  <header class="site-header">
    <a class="brand" href="#${projects[0].id}"><span class="brand-mark" aria-hidden="true"></span>${escapeHtml(site.name)}</a>
    <span class="header-meta">Illustrator × AI × 3D · ${projects.length} prototypes</span>
  </header>

  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Portfolio · Creative automation</p>
      <h1>Vector in.<br /><span>Volume out.</span></h1>
      <p class="hero-lede">${escapeHtml(site.tagline)}</p>
      <p class="hero-sub">${escapeHtml(site.intro)}</p>
      <dl class="hero-stats">
        <div><dt>6</dt><dd>working prototypes</dd></div>
        <div><dt>0</dt><dd>installs or API keys</dd></div>
        <div><dt>2D→3D</dt><dd>every project bridges both</dd></div>
      </dl>
    </div>
    ${heroArt}
  </section>

  <div class="tabs-wrap" id="projects">
    <nav class="tabs" role="tablist" aria-label="Projects">${projects.map(tabButton).join('')}</nav>
  </div>

  <main>${projects.map(panel).join('')}</main>

  <footer class="site-footer">
    <div><b>${escapeHtml(site.name)}</b> · Concepts &amp; prototypes by ${escapeHtml(site.author)}</div>
    <div class="muted">Built with Three.js and Vite. AI steps in the demos run locally; the production plugins call the APIs named in each tech stack.</div>
  </footer>`;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.hero-art animate').forEach((a) => a.remove());
}

// ---------------------------------------------------------------------------
// Tabs, routing and lazy demo mounting

const tabs = [...document.querySelectorAll('.tabs .tab')];
const demos = new Map();
let active = null;

async function mountDemo(p) {
  const root = document.querySelector(`.demo-root[data-demo="${p.id}"]`);
  try {
    const mod = await p.demo();
    const api = await mod.mount(root);
    root.classList.add('is-ready');
    return api;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="demo-error"><b>This prototype couldn’t start.</b><p>It needs a browser with WebGL enabled. ${escapeHtml(err?.message || '')}</p></div>`;
    return null;
  }
}

async function activate(id, { focusTab = false, scroll = false } = {}) {
  const p = projects.find((x) => x.id === id) || projects[0];
  if (active === p.id) return;
  const prev = active;
  active = p.id;
  if (prev) demos.get(prev)?.then((d) => d?.deactivate?.());

  tabs.forEach((t) => {
    const on = t.dataset.id === p.id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    if (on && focusTab) t.focus();
    if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  document.querySelectorAll('.panel').forEach((el) => {
    el.hidden = el.id !== `panel-${p.id}`;
  });
  if (location.hash !== `#${p.id}`) history.replaceState(null, '', `#${p.id}`);
  document.title = `${p.tab} · ${site.name}`;
  if (scroll) document.getElementById(`panel-${p.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!demos.has(p.id)) demos.set(p.id, mountDemo(p));
  const api = await demos.get(p.id);
  if (active === p.id) api?.activate?.();
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) activate(t.dataset.id);
});

document.querySelector('.tabs').addEventListener('keydown', (e) => {
  const i = tabs.findIndex((t) => t.dataset.id === active);
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = tabs.length - 1;
  if (n === null) return;
  e.preventDefault();
  activate(tabs[n].dataset.id, { focusTab: true });
});

document.querySelector('main').addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    activate(go.dataset.go, { scroll: true });
    return;
  }
  const codeTab = e.target.closest('.code-tabs button');
  if (codeTab) {
    const card = codeTab.closest('.code-card');
    card.querySelectorAll('.code-tabs button').forEach((b) => b.setAttribute('aria-selected', b === codeTab));
    card.querySelectorAll('pre').forEach((pre) => {
      pre.hidden = pre.dataset.idx !== codeTab.dataset.idx;
    });
  }
});

document.querySelector('.brand').addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('hashchange', () => activate(location.hash.slice(1), { scroll: true }));

const initial = location.hash.slice(1);
activate(initial, { scroll: !!initial && projects.some((p) => p.id === initial) });
