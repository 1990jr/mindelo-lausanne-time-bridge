// NOTE: normalizeAiDailyContent mirrors normalizeDailyPayload in
// worker/src/insight-pipeline.js.  Both run in different environments
// (browser vs Cloudflare Workers) and don't share modules, so the
// duplication is intentional.  Keep them in sync when changing the schema.

const PERIOD_ORDER = ['night', 'morning', 'midday', 'afternoon', 'evening'];

const TIME_BLOCKS = [
  { key: 'night', start: 0, end: 6 },
  { key: 'morning', start: 6, end: 10 },
  { key: 'midday', start: 10, end: 14 },
  { key: 'afternoon', start: 14, end: 18 },
  { key: 'evening', start: 18, end: 22 },
  { key: 'night', start: 22, end: 24 },
];

const DEFAULT_EMOJIS = {
  cv: {
    night: '🌙',
    morning: '☕',
    midday: '🍽️',
    afternoon: '🌊',
    evening: '🎶',
  },
  ch: {
    night: '🌙',
    morning: '🥐',
    midday: '🍽️',
    afternoon: '🚶',
    evening: '🏔️',
  },
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCityThemes(themes, city) {
  if (!themes || typeof themes !== 'object') return null;
  const normalized = {};
  for (const key of PERIOD_ORDER) {
    if (!isNonEmptyString(themes[key])) return null;
    normalized[key] = themes[key].trim();
  }
  return {
    city,
    ...normalized,
  };
}

function normalizeDayThemes(dayThemes) {
  if (!dayThemes || typeof dayThemes !== 'object') return null;
  const cv = normalizeCityThemes(dayThemes.cv, 'cv');
  const ch = normalizeCityThemes(dayThemes.ch, 'ch');
  if (!cv || !ch) return null;
  return { cv, ch };
}

export function normalizeAiDailyContent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isNonEmptyString(payload.insight)) return null;

  const weekday = normalizeDayThemes(payload?.themes?.weekday);
  const weekend = normalizeDayThemes(payload?.themes?.weekend);
  if (!weekday || !weekend) return null;

  return {
    insight: payload.insight.trim(),
    disclaimer: isNonEmptyString(payload.disclaimer)
      ? payload.disclaimer.trim()
      : 'AI-generated content may contain mistakes.',
    facts: {
      common: payload?.facts?.common || '',
      mindelo: payload?.facts?.mindelo || '',
      lausanne: payload?.facts?.lausanne || '',
    },
    themes: { weekday, weekend },
  };
}

function buildCityScenes(cityThemes, cityKey) {
  return TIME_BLOCKS.map((block) => ({
    start: block.start,
    end: block.end,
    emoji: DEFAULT_EMOJIS[cityKey][block.key],
    text: cityThemes[block.key],
  }));
}

export function buildAiHappeningOverrides(themes) {
  return {
    weekday: {
      cv: buildCityScenes(themes.weekday.cv, 'cv'),
      ch: buildCityScenes(themes.weekday.ch, 'ch'),
    },
    weekend: {
      cv: buildCityScenes(themes.weekend.cv, 'cv'),
      ch: buildCityScenes(themes.weekend.ch, 'ch'),
    },
  };
}
