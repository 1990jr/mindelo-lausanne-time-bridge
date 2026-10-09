import { getTimezoneOffset } from './time.js';

export function getLocalDateTime(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const part = type => parts.find(value => value.type === type).value;
  return {
    date: `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

// Resolve a city's wall-clock time independently of the visitor's time zone.
// A spring clock change can skip a time; an autumn change can repeat it.
export function resolveLocalDateTime(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { status: 'invalid', instants: [] };
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(year, month - 1, day);
  wallClock.setUTCHours(hour, minute, 0, 0);
  if (year < 1 || wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 ||
      wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour || wallClock.getUTCMinutes() !== minute) {
    return { status: 'invalid', instants: [] };
  }

  // Sample either side of any transition to find both possible UTC offsets.
  const wallMs = wallClock.getTime();
  const offsets = new Set([-36, 0, 36].map(hours =>
    getTimezoneOffset(new Date(wallMs + hours * 3600000), timeZone)));
  const instants = [...offsets].map(offset => new Date(wallMs - offset * 60000))
    .filter(instant => {
      const local = getLocalDateTime(instant, timeZone);
      return local.date === date && local.time === time;
    })
    .sort((a, b) => a - b);
  return { status: instants.length === 0 ? 'nonexistent' : instants.length === 1 ? 'valid' : 'ambiguous', instants };
}
