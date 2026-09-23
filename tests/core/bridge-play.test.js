import test from 'node:test';
import assert from 'node:assert/strict';
import { challenges, getChallenge } from '../../src/js/core/bridge-play.js';

test('challenge deck cycles without consecutive repeats in all languages', () => {
  for (const lang of ['en', 'fr', 'pt']) {
    assert.equal(challenges[lang].length, challenges.en.length);
    for (let i = 0; i < challenges[lang].length; i++) {
      assert.notEqual(getChallenge(i, lang).text, getChallenge(i + 1, lang).text);
    }
    assert.deepEqual(getChallenge(0, lang), getChallenge(challenges[lang].length, lang));
    assert.deepEqual(getChallenge(-1, lang), getChallenge(challenges[lang].length - 1, lang));
  }
});
