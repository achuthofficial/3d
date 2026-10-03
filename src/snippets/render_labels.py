# render_labels.py: blender -b can.blend -P render_labels.py -- <labels_dir>
import pathlib
import sys

import bpy

labels = pathlib.Path(sys.argv[sys.argv.index("--") + 1])
node = bpy.data.materials["Label"].node_tree.nodes["LabelTexture"]
scene = bpy.context.scene

for png in sorted(labels.glob("label_*.png")):
    node.image = bpy.data.images.load(str(png), check_existing=True)
    scene.render.filepath = str(labels / f"render_{png.stem.removeprefix('label_')}.png")
    bpy.ops.render.render(write_still=True)
