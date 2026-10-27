// v1's dial clock (site/src/components/temporal-drag/DialTicks.tsx readDialEpoch and helpers),
// copied without the React parts so the 2.0 drag page can use it.
export const TICK_COUNT = 60;

export const DEGREES_PER_TICK = 360 / TICK_COUNT;

export const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type DialEpoch = {
  /** Second-hand angle at mount: 0deg at 12 o'clock, clockwise. */
  secondAngle: number;
  /** Minute-hand angle at mount, including the fractional advance from seconds. */
  minuteAngle: number;
  /** Zero-padded 24-hour clock value. */
  hour: string;
  /** English-only calendar label, independent of the site's selected language. */
  dateLabel: string;
};

export function ordinalSuffix(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
}

export function formatEnglishDate(date: Date): string {
  const day = date.getDate();
  return `${ENGLISH_MONTHS[date.getMonth()]} ${day}${ordinalSuffix(day)}`;
}

export function readDialEpoch(now = new Date()): DialEpoch {
  const seconds = now.getSeconds();
  return {
    secondAngle: seconds * DEGREES_PER_TICK,
    minuteAngle: now.getMinutes() * DEGREES_PER_TICK + seconds * (DEGREES_PER_TICK / 60),
    hour: String(now.getHours()).padStart(2, '0'),
    dateLabel: formatEnglishDate(now),
  };
}
