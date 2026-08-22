# Publishing to GitHub — step by step

## One-time setup

```bash
cd garden-cup
git init
git add .
git commit -m "Garden Cup tournament tracker"
git branch -M main
```

Create an empty repo on github.com (no README, no .gitignore), then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Enable Pages

1. Repo → **Settings** → **Pages**
2. **Source**: select **GitHub Actions**
3. Done — the push already triggered a build

Check the **Actions** tab for progress. First deploy takes ~1 minute.

Your URL: `https://<your-username>.github.io/<repo-name>/`

## Updating later

```bash
git add .
git commit -m "your change"
git push
```

Every push to `main` redeploys automatically.

## Alternative: Vercel (simpler, custom domain friendly)

1. Push to GitHub as above
2. Go to vercel.com → **Add New Project** → import the repo
3. Vercel auto-detects Vite; leave the defaults and deploy
4. No `VITE_BASE` needed — Vercel serves from the domain root

Vercel gives a nicer URL and easier custom-domain setup if you own one.
