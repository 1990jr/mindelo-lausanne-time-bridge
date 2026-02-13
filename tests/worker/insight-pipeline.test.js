import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDailyFacts,
  normalizeDailyPayload,
  normalizeReviewPayload,
  isGroundedInFacts,
  buildSafeFallbackPayload,
  extractStructuredPayload,
} from '../../worker/src/insight-pipeline.js';

test('pickDailyFacts is deterministic for same day/lang', () => {
  const a = pickDailyFacts('2026-02-13', 'en');
  const b = pickDailyFacts('2026-02-13', 'en');
  assert.deepEqual(a, b);
});

test('normalizeDailyPayload validates expected schema', () => {
  const payload = {
    insight: 'Daily bridge insight.',
    disclaimer: 'AI-generated content may contain mistakes.',
    facts: { common: 'c', mindelo: 'm', lausanne: 'l' },
    themes: {
      weekday: {
        cv: { night: 'a', morning: 'b', midday: 'c', afternoon: 'd', evening: 'e' },
        ch: { night: 'a', morning: 'b', midday: 'c', afternoon: 'd', evening: 'e' },
      },
      weekend: {
        cv: { night: 'a', morning: 'b', midday: 'c', afternoon: 'd', evening: 'e' },
        ch: { night: 'a', morning: 'b', midday: 'c', afternoon: 'd', evening: 'e' },
      },
    },
  };
  assert.ok(normalizeDailyPayload(payload));
  assert.equal(normalizeDailyPayload({ insight: 'x' }), null);
});

test('normalizeReviewPayload validates reviewer response', () => {
  const review = normalizeReviewPayload({ approved: false, issues: ['bad fact'], reason: 'mismatch' });
  assert.equal(review.approved, false);
  assert.equal(review.issues.length, 1);
  assert.equal(normalizeReviewPayload({ approved: 'no' }), null);
});

test('isGroundedInFacts checks exact fact agreement', () => {
  const facts = { common: 'c', mindelo: 'm', lausanne: 'l' };
  const ok = { facts: { common: 'c', mindelo: 'm', lausanne: 'l' } };
  const bad = { facts: { common: 'c2', mindelo: 'm', lausanne: 'l' } };
  assert.equal(isGroundedInFacts(ok, facts), true);
  assert.equal(isGroundedInFacts(bad, facts), false);
});

test('buildSafeFallbackPayload reuses grounded facts', () => {
  const facts = pickDailyFacts('2026-02-13', 'pt');
  const fallback = buildSafeFallbackPayload('pt', facts);
  assert.equal(fallback.facts.common, facts.common);
  assert.ok(fallback.themes.weekday.cv.night.length > 0);
  assert.ok(fallback.themes.weekend.ch.evening.length > 0);
});

test('extractStructuredPayload parses fenced JSON', () => {
  const parsed = extractStructuredPayload('```json\n{"approved":true,"issues":[]}\n```');
  assert.equal(parsed.approved, true);
});

