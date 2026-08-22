# Garden Cup

A 1v1 football tournament tracker for garden matches. Four game modes, per-match
timers with audio warnings, goal-minute logging, top-scorer stats, and persistent
history saved to the device.

## Modes

- **League + Final** — round robin (1–4 legs), top 2 play a final
- **Pure League** — round robin, top of the table wins
- **Knockout** — randomised single-elimination bracket with automatic byes
- **Winner Stays On** — king defends the pitch, challengers queue up

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Deploy to GitHub Pages

1. Create a repo on GitHub and push this project to the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and
   deploys automatically.
4. The site appears at `https://<your-username>.github.io/<repo-name>/`

The workflow sets Vite's `base` path from the repo name automatically, so assets
resolve correctly on project Pages.

## Data & persistence

All data (current tournament, scores, goals, completed history) is stored in the
browser's `localStorage` under the keys `gardenCup:current` and
`gardenCup:history`. No backend or database required.

**This means data is per-device and per-browser.** History on your phone won't
appear on a tablet. If you later want cross-device sync, swap the `storage`
object at the top of `src/App.jsx` for a Supabase (or similar) client — the rest
of the app talks to that interface only.

Clearing browser data for the site will erase saved tournaments.

## Add to home screen

The app ships a web manifest, so on iOS (Share → Add to Home Screen) or Android
(menu → Install app) it launches fullscreen like a native app and works offline
after first load.

Replace `public/icon-192.png` and `public/icon-512.png` with your own artwork if
you want a nicer icon.

## Audio note

Browsers block sound until the user interacts with the page. The app unlocks
audio on the first tap, so tap anything once before relying on the 10-second
warning beep.
