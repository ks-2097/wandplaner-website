"""Onset detection for the R02 track: finds the beat grid and the final chord.

    python3 scripts/social/anim/beats.py marketing/audio/beat-120bpm.mp3 out.json

Decodes with ffmpeg (also works on the finished MP4, to check the muxed audio), computes a spectral-flux onset envelope (numpy/scipy), picks onset peaks,
fits tempo and phase to them, and writes {duration, bpm, phase, beats, onsets, final_chord}.
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import find_peaks

src, out = sys.argv[1], sys.argv[2]
SR = 22050
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)

HOP, N = 128, 1024
frames = 1 + (len(x) - N) // HOP
win = np.hanning(N).astype(np.float32)
idx = np.arange(N)[None, :] + HOP * np.arange(frames)[:, None]
S = np.abs(np.fft.rfft(x[idx] * win, axis=1))
L = np.log1p(100 * S)
flux = np.maximum(L[1:] - L[:-1], 0).sum(axis=1)
flux = np.concatenate([[0], flux])
t = (np.arange(frames) * HOP + N / 2) / SR
env = flux / (flux.max() + 1e-9)
rms = np.sqrt((x[idx] ** 2).mean(axis=1))

peaks, props = find_peaks(env, height=0.12, distance=int(0.12 * SR / HOP))
onsets = t[peaks]
strength = env[peaks]
# Each onset is placed where the flux rises fastest, refined to the frame start of the rise.
strong = onsets[strength > 0.3]

# Tempo + phase: grid search maximizing the sum of envelope samples at grid points.
best = None
for bpm in np.arange(110, 130.001, 0.01):
    period = 60 / bpm
    for phase in np.arange(-0.05, 0.05001, 0.002):
        g = np.arange(phase, dur, period)
        g = g[g >= 0]
        score = np.interp(g, t, env).sum()
        if best is None or score > best[0]:
            best = (score, bpm, phase)
_, bpm, phase = best
period = 60 / bpm
beats = [float(b) for b in np.arange(phase, dur, period) if b >= -1e-6]
# Deviation of every strong onset from the nearest grid beat (or half beat).
dev = [float(o - (phase + round((o - phase) / period) * period)) for o in strong]

# Final chord: the last strong onset that is followed by sustained energy to the end.
last_strong = [float(o) for o, s in zip(onsets, strength) if s > 0.3]
# Precise attack of every grid beat: the first moment the 1 ms envelope rises by more than half of
# the steepest 5 ms rise in a window around the beat (a level threshold would trip on the decay
# of the preceding off-beat sound).
env1 = np.convolve(np.abs(x), np.ones(22) / 22, mode='same')
lag = int(0.005 * SR)
beat_onsets = []
for b in beats:
    if b > dur - 0.1:
        continue
    a0, a1 = int(max(0, b - 0.06) * SR), int(min(dur, b + 0.1) * SR)
    rise = env1[a0 + lag:a1 + lag] - env1[a0:a1]
    k = int(np.argmax(rise >= 0.5 * rise.max()))
    beat_onsets.append(float((a0 + k + lag) / SR))

res = {
    'beat_onsets': beat_onsets,
    'duration': dur, 'bpm': float(bpm), 'period': period, 'phase': float(phase),
    'beats': beats, 'onsets': [float(o) for o in onsets], 'strength': [float(s) for s in strength],
    'strong_onset_dev_ms': {'max': 1000 * max(abs(d) for d in dev), 'median': 1000 * float(np.median(np.abs(dev)))},
    'last_strong_onsets': last_strong[-6:],
    'rms_tail': [[float(tt), float(r)] for tt, r in zip(t[::40], rms[::40]) if tt > dur - 4],
}
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ('beats', 'onsets', 'strength')}, indent=1))
print('beat onsets', ' '.join(f'{o:.3f}' for o in beat_onsets))
print('onsets', ' '.join(f'{o:.3f}({s:.2f})' for o, s in zip(onsets, strength)))
