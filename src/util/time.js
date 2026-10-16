/*
 * Time helpers — formatting and parsing of "mm:ss"/"hh:mm:ss" timestamps.
 * Pure functions, fully unit-tested.
 */

/**
 * Format a number of seconds as mm:ss, hh:mm:ss, adding hundredths when the
 * fractional part is non-zero. Mirrors the original getTime() output.
 */
export function formatTime(value) {
  const v = Math.abs(Number(value) || 0);
  const hundredths = Math.round((v - Math.floor(v)) * 100);
  const digit = hundredths !== 0 ? String(hundredths).padStart(2, '0') : '';

  const total = Math.floor(v);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const ss = String(seconds).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const hh = hours === 0 ? '' : String(hours).padStart(2, '0') + ':';

  return hh + mm + ':' + ss + (digit !== '' ? '.' + digit : '');
}

/**
 * Parse "ss", "mm:ss" or "hh:mm:ss" into seconds. Returns 0 for anything that
 * cannot be understood (invalid segment count or a non-numeric part).
 */
export function parseTime(text) {
  if (typeof text !== 'string') return 0;
  const parts = text.split(':');
  if (parts.length < 1 || parts.length > 3) return 0;

  let h = 0;
  let m = 0;
  let s = 0;
  if (parts.length === 3) {
    [h, m, s] = parts.map(Number);
  } else if (parts.length === 2) {
    [m, s] = parts.map(Number);
  } else {
    s = Number(parts[0]);
  }

  if ([h, m, s].some((n) => Number.isNaN(n))) return 0;
  return h * 3600 + m * 60 + s;
}
