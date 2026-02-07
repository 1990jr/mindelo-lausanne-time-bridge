import { getDayTypeInTZ, getHourInTZ } from './time.js';

export function selectSceneByHour(list, hour) {
  return list.find((item) => hour >= item.start && hour < item.end) || list[0];
}

export function pickHappeningScene({ date, tz, currentLang, weekdayByLang, weekendByDayByLang }) {
  const dayType = getDayTypeInTZ(date, tz);
  const hour = getHourInTZ(date, tz);

  const list = dayType === 'weekday'
    ? weekdayByLang[currentLang]
    : weekendByDayByLang[dayType][currentLang];

  return selectSceneByHour(list, hour);
}
