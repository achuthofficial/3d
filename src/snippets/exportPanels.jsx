// exportPanels.jsx: runs inside Illustrator (ExtendScript)
// One artboard per dieline panel → print-resolution textures + sizes.
function exportPanels(outFolder) {
  var doc = app.activeDocument;
  var panels = ["front", "back", "left", "right", "top", "bottom"];
  var opts = new ExportOptionsPNG24();
  opts.artBoardClipping = true;
  opts.antiAliasing = true;
  opts.transparency = false;
  opts.horizontalScale = opts.verticalScale = 300;   // 3× for crisp textures

  var out = [];
  for (var i = 0; i < doc.artboards.length; i++) {
    var ab = doc.artboards[i];
    if (indexOf(panels, ab.name) < 0) continue;
    doc.artboards.setActiveArtboardIndex(i);
    var file = new File(outFolder + "/" + ab.name + ".png");
    doc.exportFile(file, ExportType.PNG24, opts);
    var r = ab.artboardRect;                         // [left, top, right, bottom] in pt
    out.push('{"panel":"' + ab.name + '","w":' + (r[2] - r[0]) +
             ',"h":' + (r[1] - r[3]) + ',"file":"' + file.fsName.replace(/\\/g, "/") + '"}');
  }
  return "[" + out.join(",") + "]";                  // JSON string back to the panel
}

function indexOf(a, v) { for (var i = 0; i < a.length; i++) if (a[i] === v) return i; return -1; }
