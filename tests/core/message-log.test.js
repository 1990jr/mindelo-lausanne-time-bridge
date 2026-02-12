import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRecordMessage, createMessageLogEntry, appendMessageLog, MAX_LOG_ENTRIES } from '../../src/js/core/message-log.js';

test('shouldRecordMessage only records on text change', () => {
  assert.equal(shouldRecordMessage(null, 'hello'), true);
  assert.equal(shouldRecordMessage({ text: 'hello' }, 'hello'), false);
  assert.equal(shouldRecordMessage({ text: 'hello' }, 'world'), true);
});

test('appendMessageLog caps history length', () => {
  let entries = [];
  for (let i = 0; i < MAX_LOG_ENTRIES + 2; i++) {
    entries = appendMessageLog(entries, createMessageLogEntry({
      city: 'cv',
      dayType: 'weekday',
      source: 'static',
      text: `m${i}`,
      isoNow: new Date(0).toISOString(),
    }));
  }

  assert.equal(entries.length, MAX_LOG_ENTRIES);
  assert.equal(entries[0].text, 'm2');
});
