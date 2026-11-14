"""Room and flat-lay compositing for the social assets (called by build.ts with a JSON job file).

Same method as scripts/mockup/flatten.py: the planner is multiplied onto the blank sheet, and only
pixels that are still white paper are printed on (paper mask from chroma and brightness, blurred
by 1.2 px), so objects lying on the sheet stay on top and the scene's light stays on the paper.
Differences: the sheet rectangle is measured to sub-pixel precision from the photo (the README
heights overshoot the paper by up to 6 px in the kitchen), its edges get exact fractional coverage,
and everything is resampled straight to the output window, so a reel can zoom without re-shooting.

usage: python3 scenes.py jobs.json
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Seeds from marketing/README.md: top-left corner and width as fractions; ratio = sheet h / w.
SCENES = {
    'wohnzimmer': ('public/img/raum/wohnzimmer-2048.webp', 0.3747, 0.3125, 0.2515, 0.7),
    'kueche': ('public/img/raum/kueche-2048.webp', 0.3516, 0.2382, 0.2944, 0.7),
    'flur': ('public/img/raum/flur-1792.webp', 0.3041, 0.1188, 0.3912, 1 / 0.7),
    'flatlay': ('marketing/scenes/flatlay-blank.jpg', 0.0523, 0.2545, 0.8902, 0.7),
}

_cache = {}


def _edge(profile, lo, hi, rising):
    """Sub-pixel position of the strongest step in profile[lo:hi] (midpoint crossing)."""
    d = np.diff(profile[lo:hi])
    i = int(np.argmax(d) if rising else np.argmin(d))
    a, b = profile[lo + i], profile[lo + i + 1]
    # step lies between pixel lo+i and lo+i+1; look a few px outward for the plateau levels
    o = profile[max(lo + i - 3, 0)] if rising else profile[min(lo + i + 4, len(profile) - 1)]
    p = profile[min(lo + i + 4, len(profile) - 1)] if rising else profile[max(lo + i - 3, 0)]
    mid = (o + p) / 2
    # find crossing of mid between i-2 .. i+3
    for k in range(lo + i - 2, lo + i + 3):
        v0, v1 = profile[k], profile[k + 1]
        if (v0 - mid) * (v1 - mid) <= 0 and v0 != v1:
            # pixel centres at k+0.5; edge position in continuous coords
            return k + 0.5 + (mid - v0) / (v1 - v0)
    return lo + i + 1.0


def scene(name):
    if name in _cache:
        return _cache[name]
    path, fx, fy, fw, ratio = SCENES[name]
    im = Image.open(os.path.join(ROOT, path)).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    lum = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32)
    x0, y0, w = fx * W, fy * H, fw * W
    h = w * ratio
    xs0, xs1, ys0, ys1 = [], [], [], []
    for t in np.linspace(0.3, 0.7, 9):
        r = int(y0 + t * h)
        row = lum[r - 2:r + 3].mean(0)
        xs0.append(_edge(row, int(x0 - 25), int(x0 + 25), True))
        xs1.append(_edge(row, int(x0 + w - 25), int(x0 + w + 25), False))
        c = int(x0 + t * w)
        col = lum[:, c - 2:c + 3].mean(1)
        ys0.append(_edge(col, int(y0 - 25), int(y0 + 25), True))
        ys1.append(_edge(col, int(y0 + h - 25), int(min(y0 + h + 25, H - 1)), False))
    rect = [float(np.median(xs0)), float(np.median(ys0)), float(np.median(xs1)), float(np.median(ys1))]
    # paper mask (flatten.py): white or shadowed paper is nearly grey; wood, kraft, brass, fruit are coloured
    chroma = a.max(2) - a.min(2)
    paper = np.clip((62 - chroma) / 20, 0, 1) * (a.min(2) > 70)
    m = np.asarray(Image.fromarray((paper * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    # A softly blurred copy: the light on the paper when a reel magnifies the photo far beyond its
    # resolution (otherwise the source's compression blocks would show through the planner).
    soft = im.filter(ImageFilter.GaussianBlur(2.5))
    _cache[name] = {'img': im, 'soft': soft, 'mask': Image.fromarray(m, 'F'), 'rect': rect, 'W': W, 'H': H}
    print(f'{name}: sheet {rect[0]:.2f},{rect[1]:.2f} – {rect[2]:.2f},{rect[3]:.2f}  ({rect[2]-rect[0]:.1f} × {rect[3]-rect[1]:.1f}, ratio {(rect[2]-rect[0])/(rect[3]-rect[1]):.4f})', file=sys.stderr)
    return _cache[name]


def coverage(n, a, b):
    """Fraction of each output pixel [i, i+1) covered by the interval [a, b]."""
    i = np.arange(n, dtype=np.float64)
    return np.clip(np.minimum(i + 1, b) - np.maximum(i, a), 0, 1)


class Planner:
    """A planner raster pyramid; level 0 is the full-resolution stitched render."""

    def __init__(self, tiles, size):
        im = Image.new('RGB', tuple(size))
        for t in tiles:
            im.paste(Image.open(t['file']).convert('RGB'), (t['x'], t['y']))
        self.levels = [im]
        while self.levels[-1].width > 1200:
            p = self.levels[-1]
            self.levels.append(p.resize((p.width // 2, p.height // 2), Image.LANCZOS))

    def sample(self, box, out_w, out_h):
        """box in planner fractions (u0, v0, u1, v1), may extend beyond 0..1. Returns float32 HxWx3."""
        need = out_w / max(box[2] - box[0], 1e-9)  # level-0 px of the full sheet needed per sheet width
        lvl = self.levels[0]
        for L in self.levels:
            if L.width >= 2 * need:
                lvl = L
        pw, ph = lvl.size
        # pad so the box can extend beyond the raster (coverage handles the outside)
        pad = 8
        bx = [box[0] * pw + pad, box[1] * ph + pad, box[2] * pw + pad, box[3] * ph + pad]
        key = id(lvl)
        if getattr(self, '_padkey', None) != key:
            padded = Image.new('RGB', (pw + 2 * pad, ph + 2 * pad), lvl.getpixel((pw // 2, ph // 2)))
            padded.paste(lvl, (pad, pad))
            self._padded, self._padkey = padded, key
        bx = [min(max(bx[0], 0), pw + 2 * pad), min(max(bx[1], 0), ph + 2 * pad), min(max(bx[2], 0), pw + 2 * pad), min(max(bx[3], 0), ph + 2 * pad)]
        return np.asarray(self._padded.resize((out_w, out_h), Image.LANCZOS, box=tuple(bx))).astype(np.float32)


def composite(sc, planner, crop, out_w, out_h):
    """crop = (x, y, w, h) in scene pixels (floats). Returns a uint8 HxWx3 array."""
    x, y, w, h = crop
    box = (x, y, x + w, y + h)
    S = np.asarray(sc['img'].resize((out_w, out_h), Image.LANCZOS, box=box)).astype(np.float32)
    M = np.asarray(sc['mask'].resize((out_w, out_h), Image.BILINEAR, box=box)).astype(np.float32)
    sx, sy = out_w / w, out_h / h
    r = sc['rect']
    ox0, oy0, ox1, oy1 = (r[0] - x) * sx, (r[1] - y) * sy, (r[2] - x) * sx, (r[3] - y) * sy
    cov = coverage(out_h, oy0, oy1)[:, None] * coverage(out_w, ox0, ox1)[None, :]
    i0, i1 = max(int(np.floor(oy0)), 0), min(int(np.ceil(oy1)), out_h)
    j0, j1 = max(int(np.floor(ox0)), 0), min(int(np.ceil(ox1)), out_w)
    out = S.copy()
    # paper light: the photo itself at normal scale, its soft copy once it is magnified more than 1.5×
    wsoft = min(max((sx - 1.5) / 1.5, 0.0), 1.0)
    L = S if wsoft == 0 else S * (1 - wsoft) + np.asarray(sc['soft'].resize((out_w, out_h), Image.BICUBIC, box=box)).astype(np.float32) * wsoft
    if i1 > i0 and j1 > j0:
        # planner fractions of the output sub-window [j0, j1) × [i0, i1)
        u = lambda px: (px - ox0) / (ox1 - ox0)
        v = lambda py: (py - oy0) / (oy1 - oy0)
        P = planner.sample((u(j0), v(i0), u(j1), v(i1)), j1 - j0, i1 - i0) / 255
        m = (M[i0:i1, j0:j1] * cov[i0:i1, j0:j1])[..., None]
        out[i0:i1, j0:j1] = S[i0:i1, j0:j1] * (1 - m) + L[i0:i1, j0:j1] * P * m
    return out.clip(0, 255).round().astype(np.uint8)


def fit_roi(sc, roi, aspect):
    """Smallest crop of the given aspect that contains the region of interest, kept inside the image."""
    x0, y0, x1, y1 = roi
    w = max(x1 - x0, (y1 - y0) * aspect)
    h = w / aspect
    if h > sc['H']:
        h = sc['H']; w = h * aspect
    if w > sc['W']:
        w = sc['W']; h = w / aspect
    cx = min(max((x0 + x1) / 2, w / 2), sc['W'] - w / 2)
    cy = min(max((y0 + y1) / 2, h / 2), sc['H'] - h / 2)
    return (cx - w / 2, cy - h / 2, w, h)


def overlay(frame, ov):
    """Alpha-composite an RGBA overlay (uint8 HxWx4) onto an RGB frame."""
    if ov is None:
        return frame
    a = ov[..., 3:4].astype(np.float32) / 255
    return (frame.astype(np.float32) * (1 - a) + ov[..., :3].astype(np.float32) * a).round().astype(np.uint8)


def smooth(t):
    """Ease in and out (smootherstep)."""
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)


def ffmpeg(path, w, h, fps=30):
    return subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                             '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', path],
                            stdin=subprocess.PIPE)


def load_overlay(path):
    return np.asarray(Image.open(path).convert('RGBA')) if path else None


def run(job, planners):
    t = job['type']
    if t == 'still':
        sc = scene(job['scene'])
        crop = job.get('crop') or fit_roi(sc, job['roi'], job['w'] / job['h'])
        img = composite(sc, planners[job['planner']], crop, job['w'], job['h'])
        Image.fromarray(img).save(job['out'])
    elif t == 'pushin':
        sc = scene(job['scene'])
        P = planners[job['planner']]
        W, H, fps = job['w'], job['h'], 30
        r = sc['rect']
        c0, w0 = job['start']['c'], job['start']['w']  # centre (scene px) and width (scene px)
        # end: centre given in sheet fractions, width in sheet fractions
        sw, sh = r[2] - r[0], r[3] - r[1]
        c1 = [r[0] + job['end']['c'][0] * sw, r[1] + job['end']['c'][1] * sh]
        w1 = job['end']['w'] * sw
        n = int(round(job['seconds'] * fps))
        a, b = job['move']  # seconds when the move starts and ends
        ov = load_overlay(job.get('overlay'))
        # timed text layers (RGBA PNGs at video size) with short fades
        texts = [(load_overlay(t['png']), t['from'], t['to']) for t in job.get('texts', [])]
        fade = job.get('fade', 0.3)
        enc = ffmpeg(job['out'], W, H)
        for f in range(n):
            s = smooth((f / fps - a) / (b - a))
            wf = w0 * (w1 / w0) ** s  # geometric zoom: constant perceived speed
            k = (w0 - wf) / (w0 - w1)  # centre follows the zoom, so the target point is approached head-on
            cx = c0[0] + (c1[0] - c0[0]) * k
            cy = c0[1] + (c1[1] - c0[1]) * k
            hf = wf * H / W
            frame = overlay(composite(sc, P, (cx - wf / 2, cy - hf / 2, wf, hf), W, H), ov)
            tsec = f / fps
            for png, t0, t1 in texts:
                al = min((tsec - t0) / fade, (t1 - tsec) / fade, 1.0)
                if t1 >= job['seconds'] - 1e-6:
                    al = min((tsec - t0) / fade, 1.0)  # the last line stays to the end
                if al > 0:
                    al = smooth(al)
                    layer = png.copy()
                    layer[..., 3] = (layer[..., 3].astype(np.float32) * al).round().astype(np.uint8)
                    frame = overlay(frame, layer)
            enc.stdin.write(frame.tobytes())
            if f in [round(q * (n - 1)) for q in (0, .25, .5, .75, 1)]:
                Image.fromarray(frame).save(job['out'].replace('.mp4', f'-f{f:04d}.png'))
        enc.stdin.close()
        enc.wait()
    elif t == 'tryon':
        sc = scene(job['scene'])
        W, H, fps = job['w'], job['h'], 30
        crop = job['crop']
        stills = [overlay(composite(sc, planners[st['planner']], crop, W, H), load_overlay(st['overlay'])) for st in job['states']]
        fade = job['fade']
        enc = ffmpeg(job['out'], W, H)
        frames = []
        for i, st in enumerate(job['states']):
            for f in range(int(round(st['hold'] * fps))):
                frames.append((i, None, 0))
            if i + 1 < len(stills):
                nf = int(round(fade * fps))
                for f in range(nf):
                    frames.append((i, i + 1, smooth((f + 1) / (nf + 1))))
        n = len(frames)
        marks = [round(q * (n - 1)) for q in (0, .25, .5, .75, 1)]
        for fi, (i, j, s) in enumerate(frames):
            fr = stills[i] if j is None else (stills[i].astype(np.float32) * (1 - s) + stills[j].astype(np.float32) * s).round().astype(np.uint8)
            enc.stdin.write(fr.tobytes())
            if fi in marks:
                Image.fromarray(fr).save(job['out'].replace('.mp4', f'-f{fi:04d}.png'))
        enc.stdin.close()
        enc.wait()


def main():
    spec = json.load(open(sys.argv[1]))
    planners = {}
    for k, p in spec['planners'].items():
        planners[k] = None
    for job in spec['jobs']:
        need = [job['planner']] if 'planner' in job else [s['planner'] for s in job.get('states', [])]
        for k in need:
            if planners[k] is None:
                p = spec['planners'][k]
                planners[k] = Planner(p['tiles'], p['size'])
        run(job, planners)
        print('done', job.get('out'), file=sys.stderr)
        # free big rasters that later jobs no longer need
        later = set()
        for j2 in spec['jobs'][spec['jobs'].index(job) + 1:]:
            later.update([j2['planner']] if 'planner' in j2 else [s['planner'] for s in j2.get('states', [])])
        for k in list(planners):
            if planners[k] is not None and k not in later:
                planners[k] = None


if __name__ == '__main__':
    main()
