const DEFAULT_MODEL = 'gemini-2.0-flash';

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(env),
    });
  }

  if (url.pathname === '/health') {
    return json({ ok: true, service: 'mindelo-ai-bridge' }, 200, env);
  }

  if (url.pathname === '/api/insight' && request.method === 'POST') {
    return handleInsight(request, env);
  }

  return json({ error: 'Not found' }, 404, env);
}

async function handleInsight(request, env) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Missing GEMINI_API_KEY secret' }, 500, env);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400, env);
  }

  const prompt = buildPrompt(payload);

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 220,
      },
    }),
  });

  if (!geminiRes.ok) {
    const body = await safeText(geminiRes);
    return json({ error: 'Gemini request failed', details: body }, 502, env);
  }

  const data = await geminiRes.json();
  const insight = extractText(data);

  if (!insight) {
    return json({ error: 'No insight text returned by model' }, 502, env);
  }

  return json({ insight, model: DEFAULT_MODEL }, 200, env);
}

function buildPrompt(payload) {
  const lang = payload.lang || 'en';
  return [
    'You are helping someone bridge life between Mindelo and Lausanne.',
    `Output language: ${lang}.`,
    'Write a concise, warm daily insight in 2-4 sentences.',
    'Use this context:',
    JSON.stringify(payload, null, 2),
    'Focus on practical and human meaning (timing, weather, lifestyle differences).',
    'Do not use markdown. Do not mention being an AI.',
  ].join('\n');
}

function extractText(data) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('\n').trim();
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
