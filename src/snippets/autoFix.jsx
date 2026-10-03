// autoFix.jsx: the safe, mechanical corrections before handoff
function autoFix(doc, issues) {
  var die = ensureLayer(doc, "DIE_Cutline");
  doc.pathItems.getByName("dieline").move(die, ElementPlacement.PLACEATEND);

  while (doc.textFrames.length) doc.textFrames[0].createOutline();   // outline live text

  var logo = doc.pageItems.getByName("logo");
  var b = logo.geometricBounds, w = b[2] - b[0], h = b[1] - b[3];
  logo.resize((3.2 * h / w) * 100, 100, true, true, true, true, 100, Transformation.CENTER);

  for (var i = 0; i < issues.length; i++) {
    if (issues[i].type === "naming") {
      var layer = doc.layers.getByName(issues[i].layer);
      layer.name = suggestName(layer);               // LOGO_Primary, TXT_Copy, ART_Badge…
    }
  }
}

function ensureLayer(doc, name) {
  try { return doc.layers.getByName(name); }
  catch (e) { var l = doc.layers.add(); l.name = name; return l; }
}
