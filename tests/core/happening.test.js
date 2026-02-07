import test from 'node:test';
import assert from 'node:assert/strict';
import { pickHappeningScene } from '../../src/js/core/happening.js';

const weekdayByLang = {
  en: [
    { start: 0, end: 24, emoji: '💼', text: 'weekday' },
  ],
};

const weekendByDayByLang = {
  sat: {
    en: [{ start: 0, end: 24, emoji: '🛒', text: 'saturday' }],
  },
  sun: {
    en: [{ start: 0, end: 24, emoji: '🏖️', text: 'sunday' }],
  },
};

test('pickHappeningScene switches between weekday/saturday/sunday lists', () => {
  const sat = new Date('2026-02-07T12:00:00Z');
  const sun = new Date('2026-02-08T12:00:00Z');
  const mon = new Date('2026-02-09T12:00:00Z');

  assert.equal(pickHappeningScene({
    date: sat,
    tz: 'Europe/Zurich',
    currentLang: 'en',
    weekdayByLang,
    weekendByDayByLang,
  }).text, 'saturday');

  assert.equal(pickHappeningScene({
    date: sun,
    tz: 'Europe/Zurich',
    currentLang: 'en',
    weekdayByLang,
    weekendByDayByLang,
  }).text, 'sunday');

  assert.equal(pickHappeningScene({
    date: mon,
    tz: 'Europe/Zurich',
    currentLang: 'en',
    weekdayByLang,
    weekendByDayByLang,
  }).text, 'weekday');
});
