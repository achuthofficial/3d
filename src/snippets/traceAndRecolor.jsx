// traceAndRecolor.jsx: place the AI tile, Image Trace it, snap to brand swatches
function traceToBrand(imagePath, maxColors, swatchGroupName) {
  var doc = app.activeDocument;
  var placed = doc.placedItems.add();
  placed.file = new File(imagePath);

  var traced = placed.trace();                       // → PluginItem
  var opts = traced.tracing.tracingOptions;
  opts.tracingMode = TracingModeType.TRACINGMODECOLOR;
  opts.maxColors = maxColors;                        // 2–6 bands, like the demo slider
  opts.pathFidelity = 85;
  opts.cornerFidelity = 70;
  opts.noiseFidelity = 8;
  opts.fills = true;
  opts.strokes = false;
  app.redraw();

  var art = traced.tracing.expandTracing();          // → GroupItem of editable paths
  var brand = doc.swatchGroups.getByName(swatchGroupName).getAllSwatches();
  recolor(art, brand);
  return art;
}

function recolor(group, swatches) {
  for (var i = 0; i < group.pathItems.length; i++) {
    var p = group.pathItems[i];
    if (p.filled) p.fillColor = nearestSwatch(p.fillColor, swatches).color;  // ΔE00 in Lab
  }
  for (var j = 0; j < group.groupItems.length; j++) recolor(group.groupItems[j], swatches);
}
