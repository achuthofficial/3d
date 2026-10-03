// panel/sync.js: Illustrator artboard → Three.js CanvasTexture, inside the CEP panel
const fs = require('fs');                 // Node is enabled in the manifest
const crypto = require('crypto');
const cs = new CSInterface();
const host = (fn, ...args) =>
  new Promise((resolve) => cs.evalScript(`${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`, resolve));

let lastHash = '';
async function syncFromIllustrator() {
  const svgPath = `${cacheDir}/artboard.svg`;
  await host('exportArtboardSVG', svgPath);          // vector layers, text outlined
  const svg = fs.readFileSync(svgPath, 'utf8');
  const hash = crypto.createHash('sha1').update(svg).digest('hex');
  if (hash === lastHash) return;                     // artboard unchanged
  lastHash = hash;

  const t0 = performance.now();
  await bakeToTexture(svg, albedoCanvas);            // SVG → canvas at UV resolution
  albedoTexture.needsUpdate = true;                  // THREE.CanvasTexture on the carton
  terminal.log(`Bridge.syncTexture("Dieline_UV0") → 3D Δ ${(performance.now() - t0).toFixed(1)} ms`);
}

setInterval(syncFromIllustrator, 500);               // simple debounced poll
