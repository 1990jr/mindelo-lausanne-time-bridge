import { getMinutesInTZ, isWeekendInTZ } from './time.js';

export const CALL_AWAKE_WINDOW = { start: 8 * 60, end: 21 * 60 };

export function isWithinAwakeWindow(minutes, awakeWindow = CALL_AWAKE_WINDOW) {
  return minutes >= awakeWindow.start && minutes < awakeWindow.end;
}

export function isOverlapMoment(date, options) {
  const {
    mindeloTz,
    lausanneTz,
    awakeWindow = CALL_AWAKE_WINDOW,
  } = options;

  const mindeloMinutes = getMinutesInTZ(date, mindeloTz);
  const lausanneMinutes = getMinutesInTZ(date, lausanneTz);
  const weekendInMindelo = isWeekendInTZ(date, mindeloTz);
  const weekendInLausanne = isWeekendInTZ(date, lausanneTz);

  return weekendInMindelo &&
    weekendInLausanne &&
    isWithinAwakeWindow(mindeloMinutes, awakeWindow) &&
    isWithinAwakeWindow(lausanneMinutes, awakeWindow);
}

export function getOverlapWindows(now, options) {
  const {
    mindeloTz,
    lausanneTz,
    stepMinutes = 15,
    daysAhead = 7,
    awakeWindow = CALL_AWAKE_WINDOW,
  } = options;

  const stepMs = stepMinutes * 60 * 1000;
  const totalSteps = Math.floor((daysAhead * 24 * 60) / stepMinutes);
  const start = new Date(Math.floor(now.getTime() / stepMs) * stepMs);
  const windows = [];
  let activeStart = null;

  for (let i = 0; i <= totalSteps; i++) {
    const slot = new Date(start.getTime() + (i * stepMs));
    const active = isOverlapMoment(slot, { mindeloTz, lausanneTz, awakeWindow });

    if (active && !activeStart) {
      activeStart = slot;
    }

    if ((!active || i === totalSteps) && activeStart) {
      windows.push({ start: activeStart, end: slot });
      activeStart = null;
    }
  }

  return windows;
}
