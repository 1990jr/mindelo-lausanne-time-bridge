// NOTE: normalizeAiDailyContent mirrors normalizeDailyPayload in
// worker/src/insight-pipeline.js.  Both run in different environments
// (browser vs Cloudflare Workers) and don't share modules, so the
// duplication is intentional.  Keep them in sync when changing the schema.

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeAiDailyContent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isNonEmptyString(payload.insight)) return null;

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
  };
}
