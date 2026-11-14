"""Place a planner render on the blank sheet of a scene (multiply, so the scene's light stays on the paper).
Only pixels that are still white paper are printed on, so objects lying over the sheet stay on top.
usage: flatten.py scene.png planner.png out.jpg x y width   (sheet's top-left corner and width in scene pixels)"""
import sys, numpy as np
from PIL import Image, ImageFilter
scene, planner, out = sys.argv[1:4]; x, y, w = map(int, sys.argv[4:7])
a = np.asarray(Image.open(scene).convert('RGB')).astype(np.float32)
p = Image.open(planner).convert('RGB'); h = round(w * p.height / p.width)
pa = np.asarray(p.resize((w, h), Image.LANCZOS)).astype(np.float32)
region = a[y:y+h, x:x+w]
# white or shadowed paper is nearly grey; wood, kraft and fruit are strongly coloured
chroma = region.max(2) - region.min(2)
paper = np.clip((62 - chroma) / 20, 0, 1) * (region.min(2) > 70)
m = np.asarray(Image.fromarray((paper * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255
a[y:y+h, x:x+w] = region * (1 - m) + region * pa / 255 * m
Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(out, quality=90)
