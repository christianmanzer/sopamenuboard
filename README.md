# SOPA! menu boards

Cloudflare Worker that plays rotating menu "ad" boards on TVs.

- TV URL: `/<location>/menu/<screen>`, e.g. `/sopa/menu/1`. Right now every screen number plays the same single loop (`screens.default`); add a numbered entry under `screens` later to give a TV its own playlist
- Content: `public/<location>/playlist.json` (slides + which slides each screen plays)
- Photos: add `public/img/chicken-salad.jpg` and `public/img/chimayo.jpg` (1920x1080 works best). Photo slides with no image file set are skipped automatically
- Slide types: `logo` (full logo on pattern), `list` (menu page), `photo` (full-bleed photo + label), `rewards` (thanks + rewards)
- Per-slide scheduling: `start`/`end` (YYYY-MM-DD), `days` (0=Sun..6=Sat), `hours` (["11:00","14:00"])
- TVs pick up playlist edits within 5 minutes; page does a fresh reload after ~20h
- New restaurant: add `public/<loc>/playlist.json` + `public/img/<loc>-logo.png`

Local preview: `npm install && npx wrangler dev`, then open http://localhost:8787/sopa/menu/1
(`?slide=<id>` freezes one slide)
