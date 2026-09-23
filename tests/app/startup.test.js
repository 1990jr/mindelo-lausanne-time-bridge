import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('frontend starts, shuffles challenges, and ignores an old-language response', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
    textContent: '', innerHTML: '', dataset: {}, classList: { toggle() {}, add() {} },
    addEventListener() {},
  }]));
  let start;
  globalThis.document = {
    readyState: 'loading', documentElement: {},
    getElementById: id => elements.get(id) || null,
    querySelectorAll: () => [],
    addEventListener: (_, callback) => { start = callback; },
  };
  globalThis.window = {};
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const pending = [];
  globalThis.fetch = (url, options) => {
    if (String(url).includes('/api/insight')) {
      return new Promise(resolve => pending.push({ lang: JSON.parse(options.body).lang, resolve }));
    }
    return Promise.reject(new Error('Offline weather'));
  };
  try {
    await import('../../src/js/app.js');
    await start();
    assert.match(elements.get('timeMindelo').innerHTML, /\d\d:\d\d/);
    assert.ok(elements.get('happeningCv').textContent.length > 10);
    assert.notEqual(elements.get('happeningCv').textContent, elements.get('happeningCh').textContent);
    assert.ok(elements.get('neuroTip').textContent.length > 30);
    const first = elements.get('challengeText').textContent;
    elements.get('challengeNext').onclick();
    assert.notEqual(elements.get('challengeText').textContent, first);
    window.setLanguage('fr');
    pending[0].resolve({ ok: true, json: async () => ({ insight: 'Old English response' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending[1].lang, 'fr');
    assert.notEqual(elements.get('aiOutput').textContent, 'Old English response');
    pending[1].resolve({ ok: true, json: async () => ({ insight: 'Une invitation en français.' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('aiOutput').textContent, 'Une invitation en français.');
    window.setLanguage('pt');
    assert.match(elements.get('challengeNext').textContent, /Outro desafio/);
    pending[2].resolve({ ok: false, status: 503 });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(elements.get('aiOutput').textContent.length > 30);
  } finally {
    globalThis.setInterval = originalInterval;
  }
});
