// brandAudit.jsx: walk the document and list everything the 3D team will trip on
var BRAND = ["#E63B2E", "#3B2418", "#F5F0E6", "#14161F", "#D9C3A0"];
var NAMING = /^(ART|TXT|LOGO|DIE|3D)_[A-Z][A-Za-z0-9]*$/;

function audit(doc) {
  var issues = [];
  for (var i = 0; i < doc.layers.length; i++) {
    var layer = doc.layers[i];
    if (!NAMING.test(layer.name)) issues.push({ type: "naming", layer: layer.name });
    if (!layer.visible) issues.push({ type: "hidden", layer: layer.name });
    if (layer.pageItems.length === 0) issues.push({ type: "empty", layer: layer.name });
  }
  for (var j = 0; j < doc.pathItems.length; j++) {
    var p = doc.pathItems[j];
    if (!p.filled || p.fillColor.typename !== "RGBColor") continue;
    var hex = toHex(p.fillColor);
    if (indexOf(BRAND, hex) < 0) issues.push({ type: "color", hex: hex, bounds: p.geometricBounds });
  }
  if (doc.textFrames.length) issues.push({ type: "liveText", count: doc.textFrames.length });

  var b = doc.pageItems.getByName("logo").geometricBounds;   // [left, top, right, bottom]
  var ratio = (b[2] - b[0]) / (b[1] - b[3]);
  if (Math.abs(ratio / 3.2 - 1) > 0.01) issues.push({ type: "logoRatio", ratio: ratio });
  return issues;
}

function toHex(c) { return "#" + hx(c.red) + hx(c.green) + hx(c.blue); }
function hx(v) { var s = Math.round(v).toString(16).toUpperCase(); return s.length < 2 ? "0" + s : s; }
function indexOf(a, v) { for (var i = 0; i < a.length; i++) if (a[i] === v) return i; return -1; }
