// cleanPath.jsx: simplify a rough Pencil path and rebuild smooth / corner anchors
function cleanPath(path, tolerance, cornerDeg) {
  var pts = [];
  for (var i = 0; i < path.pathPoints.length; i++) pts.push(path.pathPoints[i].anchor);

  var keep = rdpClosed(pts, tolerance);              // Ramer–Douglas–Peucker
  var anchors = fitBezier(keep, cornerDeg);          // same maths as the web demo

  path.setEntirePath(map(anchors, function (a) { return [a.x, a.y]; }));
  for (var j = 0; j < anchors.length; j++) {
    var p = path.pathPoints[j], a = anchors[j];
    p.leftDirection = [a.inX, a.inY];
    p.rightDirection = [a.outX, a.outY];
    p.pointType = a.corner ? PointType.CORNER : PointType.SMOOTH;
  }
  path.closed = true;
  return { before: pts.length, after: anchors.length };
}
