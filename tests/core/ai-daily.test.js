import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiDailyContent } from '../../src/js/core/ai-daily.js';

const payload = {
  insight: 'Mindelo and Lausanne share a lively waterfront energy today.',
  disclaimer: 'AI-generated content may contain mistakes.',
  facts: { common: 'c', mindelo: 'm', lausanne: 'l' },
};

test('normalizeAiDailyContent validates required structure', () => {
  const normalized = normalizeAiDailyContent(payload);
  assert.ok(normalized);
  assert.equal(normalized.insight.includes('Mindelo'), true);

  assert.equal(normalized.facts.mindelo, 'm');
  assert.equal(normalizeAiDailyContent({ insight: '   ' }), null);
  assert.equal(normalizeAiDailyContent(null), null);
});
