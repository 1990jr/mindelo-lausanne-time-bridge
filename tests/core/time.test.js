import test from 'node:test';
import assert from 'node:assert/strict';
import { getDayTypeInTZ, isWeekendInTZ, getMinutesInTZ } from '../../src/js/core/time.js';

test('getDayTypeInTZ resolves weekday and weekend by timezone', () => {
  const saturdayUtc = new Date('2026-02-07T12:00:00Z');
  const mondayUtc = new Date('2026-02-09T12:00:00Z');

  assert.equal(getDayTypeInTZ(saturdayUtc, 'Atlantic/Cape_Verde'), 'sat');
  assert.equal(getDayTypeInTZ(saturdayUtc, 'Europe/Zurich'), 'sat');
  assert.equal(getDayTypeInTZ(mondayUtc, 'Europe/Zurich'), 'weekday');
  assert.equal(isWeekendInTZ(saturdayUtc, 'Europe/Zurich'), true);
  assert.equal(isWeekendInTZ(mondayUtc, 'Atlantic/Cape_Verde'), false);
});

test('getMinutesInTZ returns minute-of-day in target timezone', () => {
  const date = new Date('2026-02-07T12:30:00Z');
  const mindeloMinutes = getMinutesInTZ(date, 'Atlantic/Cape_Verde');
  const lausanneMinutes = getMinutesInTZ(date, 'Europe/Zurich');

  assert.equal(mindeloMinutes, (11 * 60) + 30);
  assert.equal(lausanneMinutes, (13 * 60) + 30);
});
