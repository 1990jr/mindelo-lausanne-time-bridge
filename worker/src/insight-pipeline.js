import { FACTS_BY_LANG, SUPPORTED_LANGS } from './facts.js';

export const PERIOD_KEYS = ['night', 'morning', 'midday', 'afternoon', 'evening'];
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
  const seedA = hashString(`${day}:${safeLang}:a`);
  const seedB = hashString(`${day}:${safeLang}:b`);
  const seedC = hashString(`${day}:${safeLang}:c`);

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

function normalizeCityThemes(cityThemes) {
  if (!cityThemes || typeof cityThemes !== 'object') return null;
  const normalized = {};
  for (const key of PERIOD_KEYS) {
    if (!isNonEmptyString(cityThemes[key])) return null;
    normalized[key] = cityThemes[key].trim();
  }
  return normalized;
}

function normalizeDayThemes(dayThemes) {
  if (!dayThemes || typeof dayThemes !== 'object') return null;
  const cv = normalizeCityThemes(dayThemes.cv);
  const ch = normalizeCityThemes(dayThemes.ch);
  if (!cv || !ch) return null;
  return { cv, ch };
}

export function normalizeDailyPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isNonEmptyString(payload.insight)) return null;
  const weekday = normalizeDayThemes(payload?.themes?.weekday);
  const weekend = normalizeDayThemes(payload?.themes?.weekend);
  if (!weekday || !weekend) return null;

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
    themes: { weekday, weekend },
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
  const markers = LANGUAGE_MARKERS[safeLang];
  if (!markers) return true;

  const insightHits = countMarkerHits(content.insight, markers);
  let themeHits = 0;
  let themeChecks = 0;
  for (const dayKey of ['weekday', 'weekend']) {
    for (const cityKey of ['cv', 'ch']) {
      for (const period of PERIOD_KEYS) {
        const text = content?.themes?.[dayKey]?.[cityKey]?.[period];
        if (typeof text === 'string' && text.trim()) {
          themeChecks += 1;
          if (countMarkerHits(text, markers) > 0) themeHits += 1;
        }
      }
    }
  }

  if (safeLang === 'en') {
    return insightHits >= 2 && themeHits >= Math.ceil(themeChecks * 0.4);
  }
  return insightHits >= 1 && themeHits >= Math.ceil(themeChecks * 0.3);
}

function buildSimpleThemes(lang) {
  const byLang = {
    en: {
      cv: {
        night: 'Quiet night in Mindelo, Atlantic breeze and slower streets.',
        morning: 'Mindelo morning starts with coffee, bread, and neighborhood chats.',
        midday: 'Lunch rhythm in Mindelo with family meals and warm weather.',
        afternoon: 'Late afternoon by the bay in Mindelo with sea air and sunshine.',
        evening: 'Mindelo evening with music, friends, and waterfront energy.',
      },
      ch: {
        night: 'Lausanne night is calm, with lights reflecting over Lake Geneva.',
        morning: 'Lausanne morning begins with bakery stops and commuter rhythm.',
        midday: 'Lausanne midday pause for lunch near work, campus, or the lake.',
        afternoon: 'Lausanne afternoon mixes city pace and lakeside walks.',
        evening: 'Lausanne evening slows down with dinners and lake views.',
      },
    },
    fr: {
      cv: {
        night: 'Nuit calme à Mindelo, brise atlantique et rues plus tranquilles.',
        morning: 'Matinée à Mindelo avec café, pain frais et discussions du quartier.',
        midday: 'Rythme du déjeuner à Mindelo avec repas en famille et chaleur.',
        afternoon: 'Fin d’après-midi à Mindelo entre baie, soleil et air marin.',
        evening: 'Soirée à Mindelo avec musique, amis et ambiance du front de mer.',
      },
      ch: {
        night: 'Nuit paisible à Lausanne avec lumières sur le lac Léman.',
        morning: 'Matin à Lausanne entre boulangerie et rythme des déplacements.',
        midday: 'Pause de midi à Lausanne près du travail, du campus ou du lac.',
        afternoon: 'Après-midi à Lausanne entre énergie urbaine et promenade au lac.',
        evening: 'Soirée à Lausanne plus calme avec dîner et vue sur le lac.',
      },
    },
    pt: {
      cv: {
        night: 'Noite calma em Mindelo, brisa atlântica e ruas mais tranquilas.',
        morning: 'Manhã em Mindelo com café, pão fresco e conversa de bairro.',
        midday: 'Ritmo de almoço em Mindelo com refeições em família e calor.',
        afternoon: 'Fim de tarde em Mindelo entre baía, sol e ar do mar.',
        evening: 'Noite em Mindelo com música, amigos e energia à beira-mar.',
      },
      ch: {
        night: 'Noite tranquila em Lausanne com luzes refletidas no Léman.',
        morning: 'Manhã em Lausanne entre padaria e ritmo de deslocação.',
        midday: 'Pausa de almoço em Lausanne perto do trabalho, campus ou lago.',
        afternoon: 'Tarde em Lausanne entre ritmo urbano e passeio no lago.',
        evening: 'Noite em Lausanne mais calma com jantar e vista para o lago.',
      },
    },
  };
  return byLang[normalizeLang(lang)];
}

export function buildSafeFallbackPayload(lang, facts) {
  const safeLang = normalizeLang(lang);
  const textByLang = {
    en: 'Today, both cities share a strong waterfront rhythm in different climates.',
    fr: 'Aujourd’hui, les deux villes partagent un rythme de vie tourné vers l’eau.',
    pt: 'Hoje, as duas cidades partilham um ritmo de vida ligado à água.',
  };
  const base = buildSimpleThemes(safeLang);
  return {
    insight: textByLang[safeLang],
    disclaimer: DEFAULT_DISCLAIMER,
    facts: {
      common: facts.common,
      mindelo: facts.mindelo,
      lausanne: facts.lausanne,
    },
    themes: {
      weekday: { cv: base.cv, ch: base.ch },
      weekend: { cv: base.cv, ch: base.ch },
    },
  };
}

function stringifyContext(payload) {
  return JSON.stringify(payload, null, 2);
}

export function buildGeneratorPrompt(payload, lang, facts) {
  return [
    'You write one daily Mindelo-Lausanne insight.',
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
    '  "facts": { "common": "...", "mindelo": "...", "lausanne": "..." },',
    '  "themes": {',
    '    "weekday": {',
    '      "cv": { "night":"...","morning":"...","midday":"...","afternoon":"...","evening":"..." },',
    '      "ch": { "night":"...","morning":"...","midday":"...","afternoon":"...","evening":"..." }',
    '    },',
    '    "weekend": {',
    '      "cv": { "night":"...","morning":"...","midday":"...","afternoon":"...","evening":"..." },',
    '      "ch": { "night":"...","morning":"...","midday":"...","afternoon":"...","evening":"..." }',
    '    }',
    '  }',
    '}',
    'Rules:',
    '- Weekdays: realistic routine, no work during night.',
    '- Weekends: no work references, Saturday morning can include groceries.',
    '- Sunday examples can mention beach in Mindelo and mountain/ski vibe in Lausanne.',
    '- Keep each theme line <= 95 characters.',
    'Context:',
    stringifyContext(payload),
  ].join('\n');
}

export function buildReviewerPrompt(candidate, lang, facts, reviewerName) {
  return [
    `You are reviewer ${reviewerName} for fact-check and realism.`,
    `Language: ${normalizeLang(lang)}.`,
    'Return JSON only:',
    '{ "approved": true|false, "issues": ["..."], "reason": "..." }',
    'Reject if ANY of these are true:',
    '- facts.common differs from provided common_fact',
    '- facts.mindelo differs from provided mindelo_fact',
    '- facts.lausanne differs from provided lausanne_fact',
    '- city themes are nonsensical or contradict weekday/weekend behavior',
    '- insight or themes are not written in the expected language',
    '- output is missing required fields',
    `common_fact: ${facts.common}`,
    `mindelo_fact: ${facts.mindelo}`,
    `lausanne_fact: ${facts.lausanne}`,
    'Candidate JSON:',
    JSON.stringify(candidate),
  ].join('\n');
}

export function buildRevisionPrompt(candidate, reviews, lang, facts) {
  return [
    'Revise this candidate JSON based on reviewer feedback.',
    `Output language: ${normalizeLang(lang)}.`,
    'Return strict JSON only with the same schema.',
    'Keep facts exactly equal to provided fact strings.',
    `common_fact: ${facts.common}`,
    `mindelo_fact: ${facts.mindelo}`,
    `lausanne_fact: ${facts.lausanne}`,
    'Candidate:',
    JSON.stringify(candidate),
    'Reviews:',
    JSON.stringify(reviews),
  ].join('\n');
}
