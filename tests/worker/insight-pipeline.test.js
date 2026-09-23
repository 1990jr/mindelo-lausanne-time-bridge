import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDailyFacts,
  normalizeDailyPayload,
  isGroundedInFacts,
  isExpectedLanguage,
  buildSafeFallbackPayload,
  extractStructuredPayload,
} from '../../worker/src/insight-pipeline.js';
import { FACTS_BY_LANG } from '../../worker/src/facts.js';

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
  };
  assert.ok(normalizeDailyPayload(payload));
  assert.equal(normalizeDailyPayload({ insight: '  ' }), null);
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
  assert.equal(fallback.facts.lausanne, facts.lausanne);
  assert.ok(fallback.insight.length > 0);
});

test('extractStructuredPayload parses fenced JSON', () => {
  const parsed = extractStructuredPayload('```json\n{"approved":true,"issues":[]}\n```');
  assert.equal(parsed.approved, true);
});

test('isExpectedLanguage rejects mismatched language content', () => {
  const ptFacts = pickDailyFacts('2026-02-13', 'pt');
  const ptContent = buildSafeFallbackPayload('pt', ptFacts);
  assert.equal(isExpectedLanguage(ptContent, 'pt'), true);
  assert.equal(isExpectedLanguage(ptContent, 'en'), false);
});

test('isExpectedLanguage does not accept English that shares a Portuguese marker', () => {
  const content = { insight: 'Pick a song from home and play it with the other person in the evening.' };
  assert.equal(isExpectedLanguage(content, 'en'), true);
  assert.equal(isExpectedLanguage(content, 'pt'), false);
});

test('pickDailyFacts picks the same fact in every language on a given day', () => {
  const index = (lang, key) => FACTS_BY_LANG[lang][key].indexOf(pickDailyFacts('2026-09-23', lang)[key]);
  for (const key of ['common', 'mindelo', 'lausanne']) {
    assert.equal(index('fr', key), index('en', key));
    assert.equal(index('pt', key), index('en', key));
  }
});

test('generator excludes untrusted and time-sensitive client context', async () => {
  const { buildGeneratorPrompt } = await import('../../worker/src/insight-pipeline.js');
  const prompt = buildGeneratorPrompt({ weatherMindelo: 'FAKE SUNNY WEATHER', lang: 'en' }, 'en', pickDailyFacts('2026-09-20', 'en'));
  assert.ok(!prompt.includes('FAKE SUNNY WEATHER'));
  assert.ok(prompt.includes('cached all day'));
});
