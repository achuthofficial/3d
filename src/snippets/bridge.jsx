// host/bridge.jsx: the ExtendScript side of the panel bridge
#target illustrator

function setText(frameName, value) {
  var layer = app.activeDocument.layers.getByName("Brand_Logo");
  layer.textFrames.getByName(frameName).contents = value;
  return "ok";
}

function setLayerVisible(name, visible) {
  app.activeDocument.layers.getByName(name).visible = visible;
  return "ok";
}

function replaceAITexture(path) {
  var layer = app.activeDocument.layers.getByName("AI_Texture_Layer");
  var placed = layer.placedItems.length ? layer.placedItems[0] : layer.placedItems.add();
  placed.file = new File(path);                  // relink to the freshly generated texture
  return placed.width + "x" + placed.height;
}

function exportArtboardSVG(path) {
  var opts = new ExportOptionsSVG();
  opts.embedRasterImages = true;
  opts.fontType = SVGFontType.OUTLINEFONT;        // text as outlines for the UV bake
  app.activeDocument.exportFile(new File(path), ExportType.SVG, opts);
  return path;
}

function savePrintPDF(path) {
  var opts = new PDFSaveOptions();
  opts.compatibility = PDFCompatibility.ACROBAT7;
  opts.pDFPreset = "[PDF/X-4:2008]";
  app.activeDocument.saveAs(new File(path), opts);
  return path;
}
