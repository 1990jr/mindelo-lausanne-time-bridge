const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const PERIOD_KEYS = ['night', 'morning', 'midday', 'afternoon', 'evening'];

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (url.pathname === '/health') {
    return json({ ok: true, service: 'mindelo-ai-bridge', provider: 'cloudflare-workers-ai' }, 200, env);
  }

  if (url.pathname === '/api/insight' && request.method === 'POST') {
    return handleInsight(request, env, url);
  }

  return json({ error: 'Not found' }, 404, env);
}

async function handleInsight(request, env, url) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    return json({ error: 'Missing Workers AI binding. Configure [ai] binding = "AI" in wrangler.toml' }, 500, env);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, env);
  }

  const lang = (payload.lang || 'en').toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  const cacheKeyUrl = `${url.origin}/cache/v2/insight/${day}/${encodeURIComponent(lang)}`;
  const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached, env);

  const prompt = buildPrompt(payload, lang);

  let aiResult;
  try {
    aiResult = await env.AI.run(DEFAULT_MODEL, {
      prompt,
      max_tokens: 700,
      temperature: 0.8,
    });
  } catch (err) {
    return json({ error: 'Workers AI request failed', details: String(err) }, 502, env);
  }

  const rawText = extractText(aiResult);
  const parsed = extractStructuredPayload(rawText);
  const content = normalizeDailyPayload(parsed);
  if (!content) {
    return json({ error: 'No valid structured daily payload returned by Workers AI' }, 502, env);
  }

  const response = new Response(JSON.stringify({
    ...content,
    model: DEFAULT_MODEL,
    cached: false,
    day,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      ...corsHeaders(env),
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function buildPrompt(payload, lang) {
  return [
    'You create one daily "Mindelo <-> Lausanne" insight with playful facts.',
    `Output language: ${lang}.`,
    'Return JSON only (no markdown, no extra text).',
    'Schema:',
    '{',
    '  "insight": "2-4 short sentences, fun and fresh for today",',
    '  "disclaimer": "AI-generated content may contain mistakes.",',
    '  "facts": {',
    '    "common": "one fun fact connecting both cities",',
    '    "mindelo": "one fun fact about Mindelo",',
    '    "lausanne": "one fun fact about Lausanne"',
    '  },',
    '  "themes": {',
    '    "weekday": {',
    '      "cv": { "night": "...", "morning": "...", "midday": "...", "afternoon": "...", "evening": "..." },',
    '      "ch": { "night": "...", "morning": "...", "midday": "...", "afternoon": "...", "evening": "..." }',
    '    },',
    '    "weekend": {',
    '      "cv": { "night": "...", "morning": "...", "midday": "...", "afternoon": "...", "evening": "..." },',
    '      "ch": { "night": "...", "morning": "...", "midday": "...", "afternoon": "...", "evening": "..." }',
    '    }',
    '  }',
    '}',
    'Rules:',
    '- Weekdays: avoid saying people are working during night/sleep hours.',
    '- Weekends: do not mention work; Saturday morning can include groceries.',
    '- Sundays: Mindelo can mention beach, Lausanne can mention mountains/ski seasonally.',
    '- Keep each theme line concise (<= 95 chars) and realistic.',
    '- Make content vary day to day.',
    'Context:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function extractText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result.response === 'string') return result.response.trim();
  if (Array.isArray(result.result) && result.result[0] && typeof result.result[0].text === 'string') {
    return result.result[0].text.trim();
  }
  return '';
}

function extractStructuredPayload(text) {
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

function normalizeDailyPayload(payload) {
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
      common: isNonEmptyString(payload?.facts?.common) ? payload.facts.common.trim() : '',
      mindelo: isNonEmptyString(payload?.facts?.mindelo) ? payload.facts.mindelo.trim() : '',
      lausanne: isNonEmptyString(payload?.facts?.lausanne) ? payload.facts.lausanne.trim() : '',
    },
    themes: {
      weekday,
      weekend,
    },
  };
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(env);
  Object.keys(cors).forEach((k) => headers.set(k, cors[k]));
  return new Response(response.body, { status: response.status, headers });
}

function json(payload, status, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env),
    },
  });
}
