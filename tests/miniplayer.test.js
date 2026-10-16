import { describe, it, expect } from 'vitest';
import { isMiniplayerActive } from '../src/platform/miniplayer.js';

function fakeDoc({ miniActiveHost = false, player = null } = {}) {
  return {
    querySelector(selector) {
      if (selector === 'ytd-miniplayer[active]') return miniActiveHost ? {} : null;
      return null;
    },
    getElementById(id) {
      if (id === 'movie_player') return player;
      return null;
    },
  };
}

describe('isMiniplayerActive', () => {
  it('is true when the miniplayer host is active', () => {
    expect(isMiniplayerActive(fakeDoc({ miniActiveHost: true }))).toBe(true);
  });

  it('is true when #movie_player sits inside ytd-miniplayer', () => {
    const player = {
      closest: (sel) => (sel === 'ytd-miniplayer' ? {} : null),
      classList: { contains: () => false },
    };
    expect(isMiniplayerActive(fakeDoc({ player }))).toBe(true);
  });

  it('is true when the player carries ytp-miniplayer', () => {
    const player = {
      closest: () => null,
      classList: { contains: (c) => c === 'ytp-miniplayer' },
    };
    expect(isMiniplayerActive(fakeDoc({ player }))).toBe(true);
  });

  it('is false on a normal watch page', () => {
    const player = { closest: () => null, classList: { contains: () => false } };
    expect(isMiniplayerActive(fakeDoc({ player }))).toBe(false);
  });

  it('is false with no document', () => {
    expect(isMiniplayerActive(null)).toBe(false);
  });
});
