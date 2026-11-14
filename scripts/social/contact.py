"""Review sheets for the social assets: one contact sheet per post and a frame strip per video
(0, 25, 50, 75, 100 %). Written next to the delivery folder, never into it.

usage: python3 contact.py OUT_DIR REVIEW_DIR
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw

out, review = sys.argv[1], sys.argv[2]
os.makedirs(review, exist_ok=True)
man = json.load(open(os.path.join(out, 'manifest.json')))['posts']
H = 900  # thumbnail height


def frames(video):
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', video]).decode())
    ims = []
    for q in (0, .25, .5, .75, 1):
        t = min(q * dur, dur - 0.05)
        png = os.path.join(review, '_f.png')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', png], check=True)
        ims.append((f'{int(q*100)} %  {t:.1f}s', Image.open(png).convert('RGB')))
        os.remove(png)
    return dur, ims


def sheet(items, path):
    thumbs = []
    for label, im in items:
        w = round(im.width * H / im.height)
        thumbs.append((label, im.resize((w, H), Image.LANCZOS)))
    W = sum(t.width for _, t in thumbs) + 24 * (len(thumbs) + 1)
    S = Image.new('RGB', (W, H + 90), '#888888')
    d = ImageDraw.Draw(S)
    x = 24
    for label, t in thumbs:
        S.paste(t, (x, 24))
        d.text((x, H + 40), label, fill='white')
        x += t.width + 24
    S.save(path, quality=88)


for pid, entries in man.items():
    items = []
    for e in entries:
        f = os.path.join(out, e['file'])
        if not os.path.exists(f):
            continue
        if e['kind'] == 'video':
            dur, fr = frames(f)
            sheet([(f"{os.path.basename(f)} {l}", im) for l, im in fr], os.path.join(review, f'{pid}-frames.jpg'))
            items.append((f"{os.path.basename(f)} ({dur:.1f}s, first frame)", fr[0][1]))
        else:
            im = Image.open(f).convert('RGB')
            items.append((f"{os.path.basename(f)} {im.width}x{im.height} {os.path.getsize(f)//1024} KB", im))
    if items:
        sheet(items, os.path.join(review, f'{pid}.jpg'))
print('review sheets in', review)
