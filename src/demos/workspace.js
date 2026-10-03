// Demo 00: the Illustra3D-AI workspace. The panel ships as a single self-contained
// HTML file (public/illustra3d.html); this tab embeds it and pauses it when hidden.
export async function mount(root) {
  root.innerHTML = `
    <div class="ws-embed">
      <div class="ws-bar">
        <span>illustra3d.html · single-file build · Three.js via CDN</span>
        <a class="btn" href="/illustra3d.html" target="_blank" rel="noopener">Open full screen ↗</a>
      </div>
      <iframe title="Illustra3D-AI pipeline workspace" src="/illustra3d.html?embed=1" allow="fullscreen"></iframe>
    </div>`;
  const frame = root.querySelector('iframe');
  const send = (type) => frame.contentWindow?.postMessage({ type }, window.location.origin);
  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin || e.source !== frame.contentWindow || e.data?.type !== 'illustra3d:height') return;
    // Wide layouts use a fixed-height workspace; stacked (narrow) layouts grow to fit.
    frame.style.height = e.data.stacked ? `${Math.ceil(e.data.height)}px` : '';
  });
  return {
    activate: () => send('illustra3d:resume'),
    deactivate: () => send('illustra3d:pause'),
  };
}
