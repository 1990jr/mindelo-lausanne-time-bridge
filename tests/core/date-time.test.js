import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalDateTime, resolveLocalDateTime } from '../../src/js/core/date-time.js';

const CV = 'Atlantic/Cape_Verde';
const CH = 'Europe/Zurich';

test('converts Mindelo to Lausanne with the offset for the chosen date', () => {
  for (const [date, expected] of [['2026-01-15', '20:30'], ['2026-07-15', '21:30']]) {
    const result = resolveLocalDateTime(date, '18:30', CV);
    assert.equal(result.status, 'valid');
    assert.deepEqual(getLocalDateTime(result.instants[0], CH), { date, time: expected });
  }
});

test('converts Lausanne to Mindelo across midnight and the year boundary', () => {
  const result = resolveLocalDateTime('2027-01-01', '00:30', CH);
  assert.deepEqual(getLocalDateTime(result.instants[0], CV), { date: '2026-12-31', time: '22:30' });
});

test('rejects the skipped spring hour in Lausanne', () => {
  assert.deepEqual(resolveLocalDateTime('2026-03-29', '02:30', CH), { status: 'nonexistent', instants: [] });
  assert.equal(resolveLocalDateTime('2026-03-29', '01:59', CH).status, 'valid');
  assert.equal(resolveLocalDateTime('2026-03-29', '03:00', CH).status, 'valid');
});

test('returns both autumn occurrences in chronological order', () => {
  const result = resolveLocalDateTime('2026-10-25', '02:30', CH);
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.instants.map(date => date.toISOString()), ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
  assert.deepEqual(result.instants.map(date => getLocalDateTime(date, CV)), [
    { date: '2026-10-24', time: '23:30' }, { date: '2026-10-25', time: '00:30' },
  ]);
});

test('Mindelo has no skipped or repeated hour during Swiss clock changes', () => {
  for (const date of ['2026-03-29', '2026-10-25']) {
    const result = resolveLocalDateTime(date, '02:30', CV);
    assert.equal(result.status, 'valid');
    assert.deepEqual(getLocalDateTime(result.instants[0], CV), { date, time: '02:30' });
  }
});

test('validates calendar dates and times without silently normalizing them', () => {
  for (const [date, time] of [
    ['', '12:00'], ['2026-02-29', '12:00'], ['2026-04-31', '12:00'],
    ['2026-13-01', '12:00'], ['2026-00-01', '12:00'], ['0000-01-01', '12:00'],
    ['2026-01-01', '24:00'], ['2026-01-01', '12:60'], ['2026-01-01', ''],
  ]) {
    assert.deepEqual(resolveLocalDateTime(date, time, CV), { status: 'invalid', instants: [] });
  }
  assert.equal(resolveLocalDateTime('2028-02-29', '12:00', CV).status, 'valid');
});

test('uses the selected city rather than the visitor time zone', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Zurich']) {
      process.env.TZ = tz;
      assert.equal(resolveLocalDateTime('2026-03-29', '01:30', CH).instants[0].toISOString(), '2026-03-29T00:30:00.000Z');
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
