import { appConfig } from '@/config/ai';

export function quotaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: appConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
