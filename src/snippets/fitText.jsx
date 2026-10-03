// fitText.jsx: shrink-to-fit an area-text frame: tighten tracking first, then size
function fitFrame(frame, minSize, allowTracking) {
  var attrs = frame.textRange.characterAttributes;
  var size = attrs.size;
  attrs.tracking = 0;
  while (allowTracking && isOverflowing(frame) && attrs.tracking > -30) {
    attrs.tracking -= 10;                            // 1/1000 em steps
  }
  while (isOverflowing(frame) && size > minSize) {
    size -= 0.5;
    attrs.size = size;
  }
  return !isOverflowing(frame);
}

// Area text overflows when the visible lines hold fewer characters than the story
// (allow one break character per line).
function isOverflowing(frame) {
  if (frame.kind !== TextType.AREATEXT) return false;
  var shown = 0;
  for (var i = 0; i < frame.lines.length; i++) shown += frame.lines[i].characters.length + 1;
  return shown < frame.characters.length;
}
