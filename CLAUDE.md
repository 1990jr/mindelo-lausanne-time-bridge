# Mindelo-Lausanne Time Bridge

## Project Overview
Single-page static web app connecting Mindelo (Cabo Verde) and Lausanne (Switzerland) with dual clocks, authored hourly scenes, weather, cultural calendar, shared call challenges, a daily AI invitation, and neuroscience tips. Designed for GitHub Pages deployment.

## Architecture
- **Frontend**: `index.html` (markup), `styles.css`, `src/js/app.js` (logic, i18n strings, authored content), pure modules in `src/js/core/`
- **Backend**: Cloudflare Worker in `worker/` generates the daily AI invitation (Workers AI), cached per day and language
- **Tests**: `npm test` runs `node --test` over `tests/`
- **No build tools**: Pure vanilla JS ES modules, no frameworks or bundlers
- **External deps**: Google Fonts (Inter, Playfair Display) via CDN
- **API**: Open-Meteo for weather data (free, no API key needed)

## Key Technical Details

### Timezones
- Mindelo: `Atlantic/Cape_Verde` (UTC-1 year-round, no DST)
- Lausanne: `Europe/Zurich` (CET UTC+1 / CEST UTC+2)
- Time difference is dynamic (3h in summer, 2h in winter), calculated from actual offsets with `Intl.DateTimeFormat` parts so it stays correct through DST transitions

### Weather API
- Uses Open-Meteo (https://open-meteo.com/) — free, no API key required
- Uses latitude/longitude coordinates for accuracy
- Mindelo: 16.89°N, 24.98°W
- Lausanne: 46.52°N, 6.63°E
- WMO weather codes mapped to emoji + descriptions
- No secrets in the codebase

### Cultural Calendar
- Easter date is computed algorithmically (Anonymous Gregorian algorithm) to derive moveable holidays
- Cabo Verde: all national public holidays + Mindelo-specific observances with fixed or computable dates (Carnaval, São Vicente Day, São João/Kola San Djon, Réveillon)
- Lausanne & Vaud: 9 official Vaud holidays + Fête de la Musique
- Festivals whose dates change every year (Baía das Gatas, Mindelact, Montreux Jazz, Paléo, Prix de Lausanne, etc.) were removed on 2026-09-23 because hardcoded dates were wrong most years. Re-add them only with confirmed yearly dates.
- Federal Fast Monday calculated dynamically (Monday after 3rd Sunday of September)
- Past events are shown dimmed and sorted after upcoming ones

### Around This Hour (happening panels)
- Authored scenes per city and hour, with weekday, Saturday, and Sunday variants (Lausanne Sundays vary by season)
- Labelled "Around this hour", not "Right now": they are evocative, not live reports. AI output no longer overrides them.

### Shared Challenges
- Seven mini-games for a call (`src/js/core/bridge-play.js`), same order in EN/FR/PT, cycled with a button

### Daily AI Invitation
- Worker prompt receives only the language and three curated facts (`worker/src/facts.js`); client context is never sent, because the response is cached for everyone all day
- Facts must stay aligned by index across languages and be checked against the sources listed in `facts.js`

### Neuroscience Tips
- 9 tips rotating daily based on day-of-year modulo
- Topics: circadian rhythms, jet lag, time perception, social jetlag, light, reminiscence bump, body temperature, napping, meal timing
- Removed 2026-09-23 as overstated or contested: glymphatic clearance, chronotype genetics, sodade and reward circuits, bilingual cognitive reserve, altitude, "blue mind"

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
