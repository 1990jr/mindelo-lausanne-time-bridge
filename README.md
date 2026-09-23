# Mindelo ↔ Lausanne Time Bridge 🌉

A single-page web app that bridges two homes — Mindelo (Cabo Verde) and Lausanne (Switzerland) — with live clocks, weather, cultural calendars, conversation challenges, and daily neuroscience insights.

## Features

- **Dual Clocks** — Live time in Mindelo (CVT, UTC-1) and Lausanne (CET/CEST) with smooth second-by-second updates
- **Around this hour** — Authored scenes of daily life in each city for the current local hour, with weekday, weekend, and seasonal variants
- **Weather Comparison** — Side-by-side live weather via Open-Meteo API (free, no key needed)
- **Cultural Calendar** — Recurring holidays and observances for Cabo Verde and Switzerland; annual festival dates are omitted until confirmed
- **Across the bridge** — Seven shared challenges you can cycle through in English, French, and Portuguese
- **Daily AI invitation** — A conversation starter with curated city facts; live weather is excluded from daily cached prompts
- **Daily Brain Insight** — Nine rotating tips on circadian rhythms, jet lag, sleep timing, and time perception
- **Mobile Responsive** — Works on phone and desktop

## Deployment on GitHub Pages

### 1. Create a private GitHub repository

```bash
cd mindelo-lausanne-time-bridge
git init
git add .
git commit -m "Initial commit"
gh repo create mindelo-lausanne-time-bridge --private --source=. --push
```

### 2. Enable GitHub Pages

1. Go to your repo on GitHub: `https://github.com/YOUR_USERNAME/mindelo-lausanne-time-bridge`
2. Navigate to **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select **main** branch, **/ (root)** folder
5. Click **Save**

Your site will be live at: `https://YOUR_USERNAME.github.io/mindelo-lausanne-time-bridge/`

> **Note:** GitHub Pages works with private repos on GitHub Pro, Team, and Enterprise plans. On the free plan, the Pages site will be public even if the repo is private.

## Tech Stack

- Pure HTML, CSS, and vanilla JavaScript
- No build tools, no frameworks, no dependencies
- Google Fonts (Inter + Playfair Display) loaded via CDN
- [Open-Meteo](https://open-meteo.com/) for weather data (free, no API key needed)

## Project Structure

```
mindelo-lausanne-time-bridge/
├── index.html          # Page markup
├── styles.css          # Styles for both city palettes
├── src/js/app.js       # App logic, i18n strings, and authored content
├── src/js/core/        # Pure modules (time zones, call windows, challenges, AI parsing)
├── worker/             # Cloudflare Worker for the daily AI invitation
├── tests/              # node --test suites (npm test)
├── README.md           # This file
└── CLAUDE.md     # Project context for Claude Code
```

## License

Personal project. Feel free to adapt for your own "time bridge" between two cities.
