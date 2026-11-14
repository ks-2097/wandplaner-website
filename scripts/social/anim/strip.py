"""Frame strip for review: frames at 0, 10, 25, 50, 75, 90 and 100 % of a video, side by side,
with the safe-area lines (top 250 px, bottom 380 px) and the 1080 x 1440 grid crop marked.

    python3 scripts/social/anim/strip.py video.mp4 strip.png [--full]   (--full also saves each frame)
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw

video, out = sys.argv[1], sys.argv[2]
info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,r_frame_rate', '-of', 'json', video], capture_output=True, text=True).stdout)
n = int(info['streams'][0]['nb_read_frames'])
pcts = [0, 10, 25, 50, 75, 90, 100]
tiles = []
with tempfile.TemporaryDirectory() as d:
    for p in pcts:
        idx = min(n - 1, round((n - 1) * p / 100))
        f = os.path.join(d, f'{p}.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select=eq(n\\,{idx})', '-vframes', '1', f], check=True)
        im = Image.open(f).convert('RGB')
        if '--full' in sys.argv:
            im.save(out.replace('.png', f'-{p:03d}.png'))
        tiles.append((p, idx, im))
s = 0.3
tw, th = int(1080 * s), int(1920 * s)
sheet = Image.new('RGB', (len(tiles) * (tw + 12) + 12, th + 52), '#ffffff')
dr = ImageDraw.Draw(sheet)
for k, (p, idx, im) in enumerate(tiles):
    x = 12 + k * (tw + 12)
    t = im.resize((tw, th), Image.LANCZOS)
    sheet.paste(t, (x, 12))
    for y in (250, 1920 - 380):
        dr.line([(x, 12 + y * s), (x + tw, 12 + y * s)], fill='#ff3b30', width=1)
    dr.rectangle([x, 12 + 240 * s, x + tw - 1, 12 + 1680 * s], outline='#0a84ff', width=1)
    dr.text((x, th + 20), f'{p}%  frame {idx}', fill='#000000')
sheet.save(out)
print(out, n, 'frames')
