export const MAX_LOG_ENTRIES = 5000;

export function shouldRecordMessage(lastEntry, nextText) {
  if (!lastEntry) return true;
  return lastEntry.text !== nextText;
}

export function createMessageLogEntry({ city, dayType, source, text, isoNow }) {
  return {
    timestamp: isoNow,
    city,
    dayType,
    source,
    text,
  };
}

export function appendMessageLog(entries, entry) {
  const next = [...entries, entry];
  if (next.length <= MAX_LOG_ENTRIES) return next;
  return next.slice(next.length - MAX_LOG_ENTRIES);
}
