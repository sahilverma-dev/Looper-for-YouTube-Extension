import { describe, it, expect } from 'vitest';
import { formatTime, parseTime } from '../src/util/time.js';

describe('formatTime', () => {
  it('formats whole seconds as mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65)).toBe('01:05');
  });

  it('adds hours when present', () => {
    expect(formatTime(3661)).toBe('01:01:01');
    expect(formatTime(3600)).toBe('01:00:00');
  });

  it('keeps hundredths when the fraction is non-zero', () => {
    expect(formatTime(1.5)).toBe('00:01.50');
    expect(formatTime(1.05)).toBe('00:01.05');
  });

  it('uses the absolute value', () => {
    expect(formatTime(-5)).toBe('00:05');
  });
});

describe('parseTime', () => {
  it('parses ss, mm:ss and hh:mm:ss', () => {
    expect(parseTime('30')).toBe(30);
    expect(parseTime('00:10')).toBe(10);
    expect(parseTime('01:00')).toBe(60);
    expect(parseTime('1:02:03')).toBe(3723);
  });

  it('returns 0 for unusable input', () => {
    expect(parseTime('abc')).toBe(0);
    expect(parseTime('1:2:3:4')).toBe(0);
    expect(parseTime('')).toBe(0);
    expect(parseTime(undefined)).toBe(0);
  });

  it('round-trips with formatTime for whole seconds', () => {
    for (const n of [0, 5, 65, 3723]) {
      expect(parseTime(formatTime(n))).toBe(n);
    }
  });
});
