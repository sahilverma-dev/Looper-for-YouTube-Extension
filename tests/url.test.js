import { describe, it, expect } from 'vitest';
import { getUrlVar, rewriteUrl, hadPositiveParamOnLoad, hadParamOnLoad } from '../src/util/url.js';

const WATCH = 'https://www.youtube.com/watch?v=abc123';

describe('getUrlVar', () => {
  it('reads a param', () => {
    expect(getUrlVar('v', '?v=abc123&list=PL1')).toBe('abc123');
    expect(getUrlVar('list', '?v=abc123&list=PL1')).toBe('PL1');
  });

  it('returns null when absent', () => {
    expect(getUrlVar('loop', '?v=abc123')).toBeNull();
  });
});

describe('rewriteUrl', () => {
  it('adds a param', () => {
    expect(rewriteUrl(WATCH, 'loop', 5)).toBe(`${WATCH}&loop=5`);
  });

  it('replaces an existing param', () => {
    expect(rewriteUrl(`${WATCH}&loop=5`, 'loop', 9)).toBe(`${WATCH}&loop=9`);
  });

  it('removes a param', () => {
    expect(rewriteUrl(`${WATCH}&loop=5`, 'loop', null)).toBe(WATCH);
  });

  it('does not disturb YouTube params', () => {
    const withList = `${WATCH}&list=PL1&index=2`;
    expect(rewriteUrl(withList, 'loop', 3)).toContain('list=PL1');
    expect(rewriteUrl(withList, 'loop', 3)).toContain('index=2');
    expect(rewriteUrl(withList, 'loop', 3)).toContain('v=abc123');
  });
});

describe('on-load param detection', () => {
  it('detects params present at load', () => {
    expect(hadParamOnLoad('start', '?v=abc&start=00:10')).toBe(true);
    expect(hadParamOnLoad('start', '?v=abc')).toBe(false);
  });

  it('detects a positive numeric value from either search string', () => {
    expect(hadPositiveParamOnLoad('loop', '?loop=5', '?loop=5')).toBe(true);
    expect(hadPositiveParamOnLoad('loop', '?v=a', '?loop=5')).toBe(true);
    expect(hadPositiveParamOnLoad('loop', '?v=a', '?v=a')).toBe(false);
  });
});
