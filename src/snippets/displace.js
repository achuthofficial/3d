// displace.js: the panel's 3D side; one depth field drives the whole mesh
import { ExtrudeGeometry } from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildType(shapes, depthMap, style) {
  let geo = new ExtrudeGeometry(shapes, { depth: 0.4, bevelEnabled: true, bevelSize: 0.018 });
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(new TessellateModifier(0.045, 14).modify(geo));  // no cracks

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = depthMap.sample(x, y);                 // 0 at the outline → 1 at stroke centre
    pos.setZ(i, z + Math.sign(z) * style.inflate * d);
    if (style.drip) pos.setY(i, y - depthMap.drip(x) * depthMap.bottomWeight(y));
  }
  geo.computeVertexNormals();
  return geo;
}
