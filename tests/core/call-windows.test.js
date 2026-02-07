import test from 'node:test';
import assert from 'node:assert/strict';
import { isOverlapMoment, getOverlapWindows } from '../../src/js/core/call-windows.js';

const options = {
  mindeloTz: 'Atlantic/Cape_Verde',
  lausanneTz: 'Europe/Zurich',
};

test('isOverlapMoment is true on weekend daytime and false on weekday', () => {
  const saturdayNoonUtc = new Date('2026-02-07T12:00:00Z');
  const mondayNoonUtc = new Date('2026-02-09T12:00:00Z');

  assert.equal(isOverlapMoment(saturdayNoonUtc, options), true);
  assert.equal(isOverlapMoment(mondayNoonUtc, options), false);
});

test('getOverlapWindows returns windows within the configured search horizon', () => {
  const start = new Date('2026-02-06T12:00:00Z');
  const windows = getOverlapWindows(start, { ...options, daysAhead: 3, stepMinutes: 30 });

  assert.ok(windows.length > 0);
  assert.ok(windows[0].start instanceof Date);
  assert.ok(windows[0].end instanceof Date);
  assert.ok(windows[0].end > windows[0].start);
});
