// panel.js: CEP panel (Chromium + Node) driving Illustrator and the 3D preview
const cs = new CSInterface();
const host = (script) => new Promise((resolve) => cs.evalScript(script, resolve));

async function oneClickMockup(brandPrompt) {
  const panels = JSON.parse(await host(`exportPanels("${cacheDir}")`));
  preview.applyDielineTextures(panels);          // Three.js: PNGs → hinged box faces
  await preview.fold({ duration: 2000 });        // sides → back → lid & base

  const backdrop = await generateBackdrop(brandPrompt);
  preview.setBackdrop(backdrop, { matchLighting: true, contactShadows: true });
  return preview.renderPNG({ width: 3000, height: 2000 });
}

async function generateBackdrop(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: `${prompt}, empty product-photography set, soft daylight, space for a box`,
      size: '1536x1024',
    }),
  });
  const { data } = await res.json();
  return `data:image/png;base64,${data[0].b64_json}`;
}
