/**
 * Returns YYYY-MM-DD in the local timezone rather than UTC,
 * preventing midnight-to-05:30 IST date drift.
 */
export function getLocalDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0];
}

/**
 * Returns time-of-day bucket for localized greetings.
 */
export function getTimeOfDayBucket(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
