/**
 * Timezone-safe date helpers for the calendar roadmap.
 *
 * A `<input type="date">` deals in bare `YYYY-MM-DD` calendar days with no
 * timezone. Mixing `toISOString()` (UTC) with `new Date(value + 'T00:00:00')`
 * (local) shifts deadlines by a day for users east/west of UTC. Everything here
 * is anchored to LOCAL noon: noon ± any UTC offset (max ±14h) stays on the same
 * calendar day, so day arithmetic and round-trips never cross a midnight
 * boundary — even across DST transitions.
 */

/** Parse a `YYYY-MM-DD` date-input value into a local-noon Date. */
export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Format a Date to `YYYY-MM-DD` using its LOCAL calendar components. */
export function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return a copy of `d` snapped to local noon of the same calendar day. */
export function toLocalNoon(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  return copy;
}
