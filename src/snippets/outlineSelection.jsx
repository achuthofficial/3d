// outlineSelection.jsx: live text → outlines → path JSON for the 3D panel
function outlineSelection() {
  var tf = app.activeDocument.selection[0];
  if (!tf || tf.typename !== "TextFrame") return '{"error":"Select a text frame"}';
  var group = tf.duplicate().createOutline();        // keep the live original intact
  var paths = [];
  collect(group, paths);
  group.remove();
  return "[" + paths.join(",") + "]";
}

function collect(item, out) {
  var i;
  if (item.typename === "GroupItem") {
    for (i = 0; i < item.pageItems.length; i++) collect(item.pageItems[i], out);
  } else if (item.typename === "CompoundPathItem") {
    for (i = 0; i < item.pathItems.length; i++) collect(item.pathItems[i], out);
  } else if (item.typename === "PathItem") {
    var pts = [];
    for (i = 0; i < item.pathPoints.length; i++) {
      var p = item.pathPoints[i];                    // anchor + both Bézier handles
      pts.push("[" + p.anchor + "," + p.leftDirection + "," + p.rightDirection + "]");
    }
    out.push('{"hole":' + (item.polarity === PolarityValues.NEGATIVE) + ',"pts":[' + pts.join(",") + "]}");
  }
}
