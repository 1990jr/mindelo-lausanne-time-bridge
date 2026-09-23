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

test('timezone offsets remain correct through DST gaps in the browser timezone', async () => {
  const { getTimezoneOffset } = await import('../../src/js/core/time.js');
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Zurich';
    for (const [iso, expected] of [
      ['2026-03-29T00:30:00Z', 60], ['2026-03-29T01:30:00Z', 120],
      ['2026-03-29T02:30:00Z', 120], ['2026-10-25T01:30:00Z', 60],
    ]) {
      assert.equal(getTimezoneOffset(new Date(iso), 'Europe/Zurich'), expected);
      assert.equal(getTimezoneOffset(new Date(iso), 'Atlantic/Cape_Verde'), -60);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
