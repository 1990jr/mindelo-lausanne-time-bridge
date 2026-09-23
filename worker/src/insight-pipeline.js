import { FACTS_BY_LANG, SUPPORTED_LANGS } from './facts.js';

export const DEFAULT_DISCLAIMER = 'AI-generated content may contain mistakes.';
const LANGUAGE_MARKERS = {
  en: [' the ', ' and ', ' with ', ' in ', ' today ', ' both ', ' city '],
  fr: [' le ', ' la ', ' les ', ' et ', ' dans ', ' aujourd', ' avec '],
  pt: [' o ', ' a ', ' os ', ' as ', ' e ', ' em ', ' hoje ', ' com '],
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export function normalizeLang(lang) {
  return SUPPORTED_LANGS.includes(lang) ? lang : 'en';
}

function pickOne(list, seed) {
  return list[seed % list.length];
}

export function pickDailyFacts(day, lang) {
  const safeLang = normalizeLang(lang);
  const facts = FACTS_BY_LANG[safeLang];
  const seedA = hashString(`${day}:a`);
  const seedB = hashString(`${day}:b`);
  const seedC = hashString(`${day}:c`);

  return {
    lang: safeLang,
    common: pickOne(facts.common, seedA),
    mindelo: pickOne(facts.mindelo, seedB),
    lausanne: pickOne(facts.lausanne, seedC),
  };
}

export function extractText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result.response === 'string') return result.response.trim();
  if (Array.isArray(result.result) && result.result[0] && typeof result.result[0].text === 'string') {
    return result.result[0].text.trim();
  }
  return '';
}

export function extractStructuredPayload(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {}
  }

  return null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeDailyPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isNonEmptyString(payload.insight)) return null;

  return {
    insight: payload.insight.trim(),
    disclaimer: isNonEmptyString(payload.disclaimer)
      ? payload.disclaimer.trim()
      : DEFAULT_DISCLAIMER,
    facts: {
      common: isNonEmptyString(payload?.facts?.common) ? payload.facts.common.trim() : '',
      mindelo: isNonEmptyString(payload?.facts?.mindelo) ? payload.facts.mindelo.trim() : '',
      lausanne: isNonEmptyString(payload?.facts?.lausanne) ? payload.facts.lausanne.trim() : '',
    },
  };
}

export function normalizeReviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.approved !== 'boolean') return null;
  const issues = Array.isArray(payload.issues)
    ? payload.issues.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 8)
    : [];

  return {
    approved: payload.approved,
    issues,
    reason: isNonEmptyString(payload.reason) ? payload.reason.trim() : '',
  };
}

export function isGroundedInFacts(content, facts) {
  if (!content || !content.facts || !facts) return false;
  return (
    content.facts.common === facts.common &&
    content.facts.mindelo === facts.mindelo &&
    content.facts.lausanne === facts.lausanne
  );
}

function countMarkerHits(text, markers) {
  const lower = ` ${String(text || '').toLowerCase()} `;
  return markers.reduce((acc, marker) => acc + (lower.includes(marker) ? 1 : 0), 0);
}

export function isExpectedLanguage(content, lang) {
  if (!content || !content.insight) return false;
  const safeLang = normalizeLang(lang);
  if (!LANGUAGE_MARKERS[safeLang]) return true;

  // Short insights share words across languages (" a " is English and
  // Portuguese), so the expected language must also out-score the others.
  const hits = Object.fromEntries(Object.entries(LANGUAGE_MARKERS)
    .map(([key, markers]) => [key, countMarkerHits(content.insight, markers)]));
  const expected = hits[safeLang];
  return expected >= (safeLang === 'en' ? 2 : 1) &&
    Object.entries(hits).every(([key, count]) => key === safeLang || count < expected);
}

export function buildSafeFallbackPayload(lang, facts) {
  const safeLang = normalizeLang(lang);
  const textByLang = {
    en: 'Your next call has a tiny mission: each pick a song that reminds you of home. Can the other person guess the memory behind it?',
    fr: 'Une petite mission pour votre prochain appel : choisissez chacun une chanson qui vous rappelle chez vous. L’autre peut-il deviner le souvenir qui se cache derrière ?',
    pt: 'Uma pequena missão para a próxima chamada: escolham uma música que vos lembre casa. A outra pessoa consegue adivinhar a memória por trás dela?',
  };
  return {
    insight: textByLang[safeLang],
    disclaimer: DEFAULT_DISCLAIMER,
    facts: {
      common: facts.common,
      mindelo: facts.mindelo,
      lausanne: facts.lausanne,
    },
  };
}

function stringifyContext(payload) {
  return JSON.stringify(payload, null, 2);
}

export function buildGeneratorPrompt(payload, lang, facts) {
  return [
    'Write a playful conversation invitation for two people connected to Mindelo and Lausanne.',
    'The insight must be a hypothetical question or mini-game, not a report or factual explanation.',
    'Use one concrete hook from the supplied facts. Avoid generic waterfront rhythm prose.',
    'Do not add facts, neuroscience, weather, events, opening hours, crowds, or claims about what residents are doing.',
    'This response is cached all day: never refer to current conditions, now, or a time difference.',
    `Output language: ${normalizeLang(lang)}.`,
    'Return strict JSON only.',
    'You MUST use the fact strings exactly as provided, without rewriting:',
    `common_fact: ${facts.common}`,
    `mindelo_fact: ${facts.mindelo}`,
    `lausanne_fact: ${facts.lausanne}`,
    'Schema:',
    '{',
    '  "insight": "2-4 concise sentences",',
    `  "disclaimer": "${DEFAULT_DISCLAIMER}",`,
    '  "facts": { "common": "...", "mindelo": "...", "lausanne": "..." }',
    '}',
    'Context:',
    stringifyContext({ lang: normalizeLang(lang) }),
  ].join('\n');
}

// buildReviewerPrompt and buildRevisionPrompt were removed — the consensus
// pipeline was replaced by a single-call generation flow to reduce AI budget
// usage by 60-80%.  The server-side validators (isGroundedInFacts,
// isExpectedLanguage, normalizeDailyPayload) provide sufficient quality gates.
