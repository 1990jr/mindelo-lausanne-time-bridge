export function getTimezoneOffset(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = type => Number(parts.find(part => part.type === type).value);
  const wallTime = Date.UTC(value('year'), value('month') - 1, value('day'),
    value('hour'), value('minute'), value('second'));
  return (wallTime - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

export function isSwissDST(date, lausanneTz) {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const janOffset = getTimezoneOffset(jan, lausanneTz);
  const julOffset = getTimezoneOffset(jul, lausanneTz);
  const currentOffset = getTimezoneOffset(date, lausanneTz);
  return currentOffset === Math.max(janOffset, julOffset);
}

export function getHourInTZ(date, tz) {
  return parseInt(date.toLocaleString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }), 10);
}

export function getMinutesInTZ(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return (hour * 60) + minute;
}

export function isWeekendInTZ(date, tz) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

export function getDayTypeInTZ(date, tz) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(date);
  if (weekday === 'Sat') return 'sat';
  if (weekday === 'Sun') return 'sun';
  return 'weekday';
}
