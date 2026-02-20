# Mindelo-Lausanne Time Bridge

## Project Overview
Single-page static web app connecting Mindelo (Cabo Verde) and Lausanne (Switzerland) with dual clocks, weather, cultural calendar, and neuroscience tips. Designed for GitHub Pages deployment.

## Architecture
- **Single file**: `index.html` contains all HTML, CSS, and JavaScript
- **No build tools**: Pure vanilla JS, no frameworks or bundlers
- **External deps**: Google Fonts (Inter, Playfair Display) via CDN
- **API**: Open-Meteo for weather data (free, no API key needed)

## Key Technical Details

### Timezones
- Mindelo: `Atlantic/Cape_Verde` (UTC-1 year-round, no DST)
- Lausanne: `Europe/Zurich` (CET UTC+1 / CEST UTC+2)
- Time difference is dynamic (1h in summer, 2h in winter) — calculated from actual offsets

### Weather API
- Uses Open-Meteo (https://open-meteo.com/) — free, no API key required
- Uses latitude/longitude coordinates for accuracy
- Mindelo: 16.89°N, 24.98°W
- Lausanne: 46.52°N, 6.63°E
- WMO weather codes mapped to emoji + descriptions
- No secrets in the codebase

### Cultural Calendar
- Easter date is computed algorithmically (Anonymous Gregorian algorithm) to derive moveable holidays
- Cabo Verde: all national public holidays + Mindelo-specific events (Carnaval, São Vicente Day, Baía das Gatas, São João/Kola San Djon, Mindelact, Réveillon)
- Lausanne & Vaud: 9 official Vaud holidays + 14 festivals/cultural events
  - Festivals: Prix de Lausanne, BDFIL, Balélec, Festival de la Cité, Montreux Jazz, Paléo Nyon, LUFF, Les Urbaines, Bô Noël
  - Sports: Athletissima (Diamond League), Lausanne Marathon
  - Wine: Caves Ouvertes Vaudoises, Vendanges in Lavaux
  - Music: Fête de la Musique
- Federal Fast Monday calculated dynamically (Monday after 3rd Sunday of September)
- Past events are shown dimmed and sorted after upcoming ones

### Neuroscience Tips
- 15 tips rotating daily based on day-of-year modulo
- Topics: circadian rhythms, jet lag, sleep, saudade, bilingualism, chronotypes, etc.

## Deployment
- GitHub Pages from main branch, root folder
- Repo is private; Pages site is public (this is expected — no secrets in the page)
- See README.md for step-by-step deployment instructions

## Style Conventions
- CSS uses custom properties (variables) for both color palettes
- Cabo Verde palette: ocean blues, warm sand tones
- Swiss palette: mountain greens, slate grays, lake blues
- Font: Inter for body, Playfair Display for headings
- Mobile breakpoint at 700px — stacks to single column
