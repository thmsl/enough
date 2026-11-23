# Enough — quit smoking PWA

Live: https://thmsl.github.io/enough/

A no-build, offline-first PWA. All data lives in `localStorage` (`enough.v1`); export or import a JSON backup from Settings.

## Run
    python3 -m http.server 8000   # then open http://localhost:8000

To install on a phone it must be served over HTTPS (any static host works: Netlify, GitHub Pages, Cloudflare Pages…).

## Structure
- `js/content.js` — milestones (with sources), badges, the 37 missions, craving tags, tips
- `js/calc.js` — pure calculations (runs, savings, taper plan, streaks, triggers)
- `js/store.js` — state, persistence, import/export
- `js/app.js` — views, routing (hash), events, live ticker
- `js/charts.js` — small SVG bar/ring charts and tooltips
- `js/notify.js` — local reminders · `js/share.js` — share card · `sw.js` — offline cache

Bump `VERSION` in `sw.js` when you deploy changes.

## Known limits
- Reminders: without a push server, a web app can't schedule notifications. They fire while the app is open or in the background, and ones you missed show up when you reopen it.
- iOS shows notifications only after the app is added to the Home Screen (iOS 16.4+).

## Credits
Fonts: [Fraunces](https://github.com/undercasetype/Fraunces) and [Inter](https://github.com/rsms/inter), both under the SIL Open Font License 1.1.
