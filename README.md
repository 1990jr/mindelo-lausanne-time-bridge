# Mindelo ↔ Lausanne Time Bridge 🌉

A single-page web app that bridges two homes — Mindelo (Cabo Verde) and Lausanne (Switzerland) — with live clocks, weather, cultural calendars, and daily neuroscience insights.

## Features

- **Dual Clocks** — Live time in Mindelo (CVT, UTC-1) and Lausanne (CET/CEST) with smooth second-by-second updates
- **"What's Happening Now"** — Contextual messages about daily life in each city based on the current local time
- **Weather Comparison** — Side-by-side live weather via OpenWeatherMap API
- **Cultural Calendar** — Upcoming holidays and events for Cabo Verde and Switzerland
- **Daily Brain Insight** — Rotating neuroscience tips about circadian rhythms, jet lag, time perception, and more
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
├── index.html    # The entire app (HTML + CSS + JS in one file)
├── README.md     # This file
└── claude.md     # Project context for Claude Code
```

## License

Personal project. Feel free to adapt for your own "time bridge" between two cities.
