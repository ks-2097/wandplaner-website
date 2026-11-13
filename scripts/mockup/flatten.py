"""Place a planner render on the blank sheet of a room scene (multiply, so the room's light stays on the paper).
usage: flatten.py room.png planner.png out.jpg x y width   (sheet's top-left corner and width in room pixels)"""
import sys, numpy as np
from PIL import Image
room, planner, out = sys.argv[1:4]; x, y, w = map(int, sys.argv[4:7])
a = np.asarray(Image.open(room).convert('RGB')).astype(np.float32)
p = Image.open(planner).convert('RGB'); h = round(w * p.height / p.width)
pa = np.asarray(p.resize((w, h), Image.LANCZOS)).astype(np.float32)
a[y:y+h, x:x+w] = a[y:y+h, x:x+w] * pa / 255
Image.fromarray(a.astype(np.uint8)).save(out, quality=90)
