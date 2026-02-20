import {
  buildGeneratorPrompt,
  buildSafeFallbackPayload,
  extractText,
  extractStructuredPayload,
  normalizeDailyPayload,
  normalizeLang,
  isGroundedInFacts,
  isExpectedLanguage,
  pickDailyFacts,
} from './insight-pipeline.js';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_DAILY_AI_CALL_LIMIT = 5;
const CACHE_VERSION = 'v4';
const BUDGET_VERSION = 'v1';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const dailyLimit = getDailyLimit(env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (url.pathname === '/health') {
    return json({
      ok: true,
      service: 'mindelo-ai-bridge',
      provider: 'cloudflare-workers-ai',
      mode: 'single-call',
      dailyAiCallLimit: dailyLimit,
    }, 200, env);
  }

  if (url.pathname === '/api/insight' && request.method === 'POST') {
    return handleInsight(request, env, url, dailyLimit);
  }

  return json({ error: 'Not found' }, 404, env);
}

async function handleInsight(request, env, url, dailyLimit) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    return json({ error: 'Missing Workers AI binding. Configure [ai] binding = "AI" in wrangler.toml' }, 500, env);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, env);
  }

  const lang = normalizeLang((payload.lang || 'en').toLowerCase());
  const day = new Date().toISOString().slice(0, 10);
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/cache/${CACHE_VERSION}/insight/${day}/${encodeURIComponent(lang)}`);
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached, env);

  const budget = await readDailyBudget(cache, url.origin, day);
  if (budget.used >= dailyLimit) {
    const fallbackFacts = pickDailyFacts(day, lang);
    const fallback = buildSafeFallbackPayload(lang, fallbackFacts);
    return json({
      ...fallback,
      model: DEFAULT_MODEL,
      cached: false,
      day,
      mode: 'fallback-daily-limit-reached',
      aiCallsUsedToday: budget.used,
    }, 200, env);
  }

  const facts = pickDailyFacts(day, lang);
  const runAi = makeAiRunner({
    env,
    cache,
    origin: url.origin,
    day,
    hardLimit: dailyLimit,
    model: DEFAULT_MODEL,
  });

  let content = null;
  let mode = 'fallback';
  try {
    const prompt = buildGeneratorPrompt(payload, lang, facts);
    const text = extractText(await runAi(prompt));
    const parsed = extractStructuredPayload(text);
    content = normalizeDailyPayload(parsed);
    mode = content ? 'single-call' : 'fallback-invalid-generator';
  } catch (err) {
    content = null;
  }

  if (!content || !isGroundedInFacts(content, facts) || !isExpectedLanguage(content, lang)) {
    content = buildSafeFallbackPayload(lang, facts);
    mode = 'fallback-grounded';
  }

  const currentBudget = await readDailyBudget(cache, url.origin, day);
  const response = new Response(JSON.stringify({
    ...content,
    model: DEFAULT_MODEL,
    cached: false,
    day,
    mode,
    aiCallsUsedToday: currentBudget.used,
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

function makeAiRunner({ env, cache, origin, day, hardLimit, model }) {
  return async function run(prompt) {
    const canRun = await consumeBudget(cache, origin, day, hardLimit);
    if (!canRun.ok) {
      throw new Error('Daily AI call limit reached');
    }
    const raw = await env.AI.run(model, {
      prompt,
      max_tokens: 900,
      temperature: 0.6,
    });
    return raw;
  };
}

function getDailyLimit(env) {
  const raw = Number.parseInt(String(env.DAILY_AI_CALL_LIMIT || DEFAULT_DAILY_AI_CALL_LIMIT), 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_DAILY_AI_CALL_LIMIT;
  return raw;
}

function budgetKey(origin, day) {
  return new Request(`${origin}/cache/${BUDGET_VERSION}/daily-ai-budget/${day}`);
}

function budgetTtlSeconds() {
  return 48 * 60 * 60;
}

async function readDailyBudget(cache, origin, day) {
  const key = budgetKey(origin, day);
  const cached = await cache.match(key);
  if (!cached) return { used: 0 };

  try {
    const data = await cached.json();
    return { used: Number.isFinite(data.used) ? data.used : 0 };
  } catch {
    return { used: 0 };
  }
}

// NOTE: The Cache API read-then-write in consumeBudget is not atomic, so
// concurrent requests could read the same budget value before either writes.
// In practice the window is small — the response-level cache (cacheKey) ensures
// at most 3 concurrent first-requests (one per language: en/fr/pt) on a cache
// miss.  After the first success for a given day+lang, the cached response is
// returned immediately with no AI call.
async function consumeBudget(cache, origin, day, hardLimit) {
  const key = budgetKey(origin, day);
  const current = await readDailyBudget(cache, origin, day);
  if (current.used >= hardLimit) {
    return { ok: false, used: current.used };
  }
  const nextUsed = current.used + 1;
  const response = new Response(JSON.stringify({
    used: nextUsed,
    updatedAt: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${budgetTtlSeconds()}`,
    },
  });
  await cache.put(key, response);
  return { ok: true, used: nextUsed };
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
