const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

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
  const cacheKeyUrl = `${url.origin}/cache/insight/${day}/${encodeURIComponent(lang)}`;
  const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    return withCors(cached, env);
  }

  const prompt = buildPrompt(payload, lang);

  let aiResult;
  try {
    aiResult = await env.AI.run(DEFAULT_MODEL, {
      prompt,
      max_tokens: 220,
      temperature: 0.6,
    });
  } catch (err) {
    return json({ error: 'Workers AI request failed', details: String(err) }, 502, env);
  }

  const insight = extractInsight(aiResult);
  if (!insight) {
    return json({ error: 'No insight text returned by Workers AI', details: aiResult }, 502, env);
  }

  const response = new Response(JSON.stringify({
    insight,
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
    'You are helping someone bridge life between Mindelo and Lausanne.',
    `Output language: ${lang}.`,
    'Write one concise daily insight in 2-4 sentences.',
    'Use this context:',
    JSON.stringify(payload, null, 2),
    'Focus on practical and human meaning (timing, weather, lifestyle differences).',
    'Do not use markdown. Do not mention being an AI.',
  ].join('\n');
}

function extractInsight(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result.response === 'string') return result.response.trim();
  if (Array.isArray(result.result) && result.result[0] && typeof result.result[0].text === 'string') {
    return result.result[0].text.trim();
  }
  return '';
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
