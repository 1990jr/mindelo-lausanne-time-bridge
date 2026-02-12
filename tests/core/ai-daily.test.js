import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiDailyContent, buildAiHappeningOverrides } from '../../src/js/core/ai-daily.js';

const payload = {
  insight: 'Mindelo and Lausanne share a lively waterfront energy today.',
  disclaimer: 'AI-generated content may contain mistakes.',
  themes: {
    weekday: {
      cv: { night: 'cv night', morning: 'cv morning', midday: 'cv midday', afternoon: 'cv afternoon', evening: 'cv evening' },
      ch: { night: 'ch night', morning: 'ch morning', midday: 'ch midday', afternoon: 'ch afternoon', evening: 'ch evening' },
    },
    weekend: {
      cv: { night: 'cv w night', morning: 'cv w morning', midday: 'cv w midday', afternoon: 'cv w afternoon', evening: 'cv w evening' },
      ch: { night: 'ch w night', morning: 'ch w morning', midday: 'ch w midday', afternoon: 'ch w afternoon', evening: 'ch w evening' },
    },
  },
};

test('normalizeAiDailyContent validates required structure', () => {
  const normalized = normalizeAiDailyContent(payload);
  assert.ok(normalized);
  assert.equal(normalized.insight.includes('Mindelo'), true);

  const invalid = normalizeAiDailyContent({ insight: 'x', themes: {} });
  assert.equal(invalid, null);
});

test('buildAiHappeningOverrides expands themes into 24h blocks', () => {
  const normalized = normalizeAiDailyContent(payload);
  const overrides = buildAiHappeningOverrides(normalized.themes);
  assert.equal(overrides.weekday.cv.length, 6);
  assert.equal(overrides.weekday.cv[0].start, 0);
  assert.equal(overrides.weekday.cv[5].end, 24);
  assert.equal(overrides.weekday.cv[1].text, 'cv morning');
});
