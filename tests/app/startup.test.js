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
  const buttons = ['EN', 'FR', 'PT'].map(textContent => ({
    textContent, classList: { toggle() {} }, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
  }));
  globalThis.document = {
    readyState: 'loading', documentElement: {},
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '.lang-btn' ? buttons : [],
    addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') start = callback; },
  };
  globalThis.window = {};
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const pending = [];
  let weatherRequests = 0;
  globalThis.fetch = (url, options) => {
    if (String(url).includes('/api/insight')) {
      return new Promise(resolve => pending.push({ lang: JSON.parse(options.body).lang, resolve }));
    }
    weatherRequests += 1;
    return Promise.resolve({ ok: true, json: async () => ({
      current: { weather_code: 0, temperature_2m: 23, apparent_temperature: 24, relative_humidity_2m: 65, wind_speed_10m: 10 },
      daily: {},
    }) });
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
    assert.equal(buttons[1].attributes['aria-pressed'], 'true');
    assert.equal(buttons[0].attributes['aria-pressed'], 'false');
    pending[0].resolve({ ok: true, json: async () => ({ insight: 'Old English response' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending[1].lang, 'fr');
    assert.notEqual(elements.get('aiOutput').textContent, 'Old English response');
    pending[1].resolve({ ok: true, json: async () => ({ insight: 'Une invitation en français.' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('aiOutput').textContent, 'Une invitation en français.');
    assert.ok([...storage.values()].some(value => value.includes('Une invitation en français.')));
    assert.equal(weatherRequests, 2, 'language switches reuse weather for both cities');
    assert.match(elements.get('weatherCvContent').innerHTML, /Ressenti/);
    window.setLanguage('pt');
    assert.match(elements.get('challengeNext').textContent, /Outro desafio/);
    pending[2].resolve({ ok: false, status: 503 });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(elements.get('aiOutput').textContent.length > 30);
    window.setLanguage('en');
    pending[3].resolve({ ok: true, json: async () => ({ insight: 'Fallback mission text.', mode: 'fallback-error' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('aiOutput').textContent, 'Fallback mission text.');
    assert.ok(![...storage.values()].some(value => value.includes('Fallback mission text.')));
    window.setLanguage('__proto__');
    assert.equal(document.documentElement.lang, 'en');
  } finally {
    globalThis.setInterval = originalInterval;
  }
});

test('frontend starts and switches language when browser storage is blocked', async () => {
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
    addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') start = callback; },
  };
  globalThis.window = {};
  globalThis.localStorage = {
    getItem() { throw new Error('Storage unavailable'); },
    setItem() { throw new Error('Storage unavailable'); },
  };
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  globalThis.fetch = () => Promise.reject(new Error('Offline'));
  try {
    await import('../../src/js/app.js?blocked-storage');
    await start();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(elements.get('timeMindelo').innerHTML, /\d\d:\d\d/);
    window.setLanguage('pt');
    assert.equal(document.documentElement.lang, 'pt');
    assert.match(elements.get('challengeNext').textContent, /Outro desafio/);
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    globalThis.setInterval = originalInterval;
  }
});
