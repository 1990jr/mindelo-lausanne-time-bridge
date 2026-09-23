import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDailyFacts,
  normalizeDailyPayload,
  isExpectedLanguage,
  buildSafeFallbackPayload,
  extractStructuredPayload,
  extractText,
} from '../../worker/src/insight-pipeline.js';
import { FACTS_BY_LANG } from '../../worker/src/facts.js';

test('pickDailyFacts is deterministic for same day/lang', () => {
  const a = pickDailyFacts('2026-02-13', 'en');
  const b = pickDailyFacts('2026-02-13', 'en');
  assert.deepEqual(a, b);
});

test('normalizeDailyPayload keeps the insight and attaches curated facts', () => {
  const facts = { common: 'c', mindelo: 'm', lausanne: 'l' };
  const normalized = normalizeDailyPayload({ insight: ' Daily bridge insight. ', facts: { common: 'rewritten' } }, facts);
  assert.equal(normalized.insight, 'Daily bridge insight.');
  assert.deepEqual(normalized.facts, facts);
  assert.equal(normalizeDailyPayload({ insight: '  ' }, facts), null);
  assert.equal(normalizeDailyPayload(null, facts), null);
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
  assert.ok(buildGeneratorPrompt({}, 'pt', pickDailyFacts('2026-09-20', 'pt')).includes('European Portuguese'));
});

test('extractText reads every Workers AI response shape', () => {
  const json = '{"insight":"Pick a song."}';
  assert.equal(extractText({ response: ` ${json} ` }), json);
  assert.equal(extractText({ response: { insight: 'Pick a song.' } }), json);
  assert.equal(extractText({ choices: [{ message: { content: json } }] }), json);
  assert.equal(extractStructuredPayload(extractText({ response: { insight: 'Pick a song.' } })).insight, 'Pick a song.');
  assert.equal(extractText({ usage: {} }), '');
});

test('isExpectedLanguage accepts short playful questions in each language', () => {
  const en = { insight: 'If you could send one song across the ocean, which would it be?' };
  const fr = { insight: 'Si vous pouviez envoyer une chanson, laquelle choisiriez-vous pour votre appel ?' };
  const pt = { insight: 'Se pudessem enviar uma música para a outra pessoa, qual seria? Cada um escolhe a sua.' };
  assert.equal(isExpectedLanguage(en, 'en'), true);
  assert.equal(isExpectedLanguage(fr, 'fr'), true);
  assert.equal(isExpectedLanguage(pt, 'pt'), true);
  assert.equal(isExpectedLanguage(en, 'pt'), false);
  assert.equal(isExpectedLanguage(pt, 'fr'), false);
});

test('extractStructuredPayload recovers an insight with a raw line break', () => {
  const parsed = extractStructuredPayload('{ "insight": "Line one.\nLine two." }');
  assert.equal(parsed.insight, 'Line one. Line two.');
});
