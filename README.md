# Plana Studio: launching-soon website

A static page (no build step) for `plana-planer.de` with a waiting-list signup, plus Impressum and Datenschutz. Styled with the Plana Studio design system; Poppins is self-hosted, so no data goes to Google.

## Files

- `index.html`: the page
- `impressum.html`, `datenschutz.html`: legal pages with `[placeholders]` to fill in
- `assets/styles.css`: tokens and styles
- `assets/fonts/`: Poppins 400–700 (latin subset, SIL OFL)
- `assets/img/`: planner images (WebP + JPG) and `og.jpg` for link previews

## Before going live

1. Fill in every `[placeholder]` in `impressum.html` and `datenschutz.html`. Replace the privacy text with one from your legal-text service, or have it checked.
2. Connect the waiting list. In Brevo (free plan), create a contact attribute `BUNDESLAND` (text) and a signup form with double opt-in. Copy the form's action URL and paste it into `data-endpoint=""` on the `<form id="signup">` in `index.html`. Until then the button shows "Die Anmeldung öffnet in Kürze."
3. Upload the folder to any static host (the planned VPS with Caddy or nginx, or a free static host) and point `plana-planer.de` at it.

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
