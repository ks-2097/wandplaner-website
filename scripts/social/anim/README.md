# Animated reels (R01, R02)

Two Instagram Reels, 1080 × 1920, H.264 yuv420p, 30 fps, CRF 18, `+faststart`. The planner in every frame is the engine's own render (`buildScene` + `renderSvg` from a spec validated with `specSchema`). Chromium rasterises the SVG at output size for each frame, so lines stay sharp at any zoom. Outputs go to the scratchpad (`…/scratchpad/social/out/R0x/`), never into the repo.

```sh
npx tsx scripts/social/anim/r01.ts            # R01 "Der Planer lebt", 15 s, no audio
npx tsx scripts/social/anim/r01.ts --check    # placement + camera checks only, no frames
npx tsx scripts/social/anim/r02.ts            # R02 "Du entscheidest", 24.03 s, with marketing/audio/beat-120bpm.mp3
# both take --out <dir> (a folder outside the repo; R01/ and R02/ are created inside it)
```

Each run writes the MP4, a cover JPEG (1080 × 1920; the centre 1080 × 1440 works as the grid crop) and a review strip (`R0x-strip.png`: frames at 0/10/25/50/75/90/100 %, with the safe-area lines and the grid crop marked). R01 also writes `notes.txt` (every note with its date, pen and time). R02 also writes `cuts.txt` (each cut next to its detected beat attack).

- `lib.ts`: the stage (one Playwright page with the fonts embedded), spec validation, ffmpeg encoding and the strip/cover helpers. It imports `fontCss` and `chromium` from `../render.ts`.
- `r01.ts`: day cells are read from the scene's grid lines and checked against the printed day numbers. Handwriting is an SVG overlay in Gloria Hallelujah (5.2–5.6 mm). Notes are placed in the free space of their cell, using ink boxes measured in Chromium. The build fails if a note leaves its cell, touches a printed number or label, overlaps another note, or is outside the safe band while it is being written. Pen loops around dates may cross a printed month bar, never text.
  - Camera: follows spline keyframes (`KF`). It opens on whole title words ("zweitausend&"), drifts through the year and ends on a mid zoom (`FINAL`, about 4.35 px/mm) on June to early October. The end card is a band over that view.
  - Pull-back notes (`t: -1`): timed automatically once their cell is in view. A note whose cell never comes into view is left out, and the build logs it.
  - The check prints the ink height of the note lines and how many visible cells are written on in the final view.
- `r02.ts`: one property per state; each state is validated and must not need repair by `sanitizeSpec`. The frame shows the label at the top of the safe area and the whole sheet at full safe width. Below it, a 2.5× detail panel of the same SVG shows the title and the first rows, placed where the title is anchored; a thin frame on the sheet marks the panel's region. Cuts sit on the frame nearest each beat attack found by `beats.py`. After muxing, the beats are detected again in the MP4 to check the audio has not shifted.
- `beats.py`: onset detection (spectral flux + a tempo/phase grid search, then a steepest-rise attack per beat). It works on the MP3 or the finished MP4.
- `strip.py`: the review strip.
