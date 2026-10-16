import { describe, it, expect } from 'vitest';
import { decideLoop, ACTIONS } from '../src/core/loop-engine.js';

const base = {
  duration: 100,
  currentTime: 0,
  playerState: 1,
  portion: { enabled: false, start: 0, end: 0 },
  count: { enabled: false, limit: 0, counter: 0 },
  timer: { enabled: false, limit: 0, elapsed: 0 },
  playlistContinue: false,
};

const state = (over = {}) => ({ ...base, ...over });

describe('decideLoop — guards', () => {
  it('ignores when there is no duration', () => {
    expect(decideLoop(state({ duration: 0 })).action).toBe(ACTIONS.IGNORE);
  });

  it('does nothing mid-video', () => {
    expect(decideLoop(state({ currentTime: 30 })).action).toBe(ACTIONS.NONE);
  });
});

describe('decideLoop — normal end', () => {
  it('restarts at 0 near the end', () => {
    const d = decideLoop(state({ currentTime: 99.95 }));
    expect(d.action).toBe(ACTIONS.RESTART);
    expect(d.seekTo).toBe(0);
    expect(d.incrementCounter).toBe(true);
  });

  it('polls within one second of the end', () => {
    expect(decideLoop(state({ currentTime: 99.5 })).action).toBe(ACTIONS.POLL);
  });

  it('pauses when a finite count is exhausted', () => {
    const d = decideLoop(
      state({ currentTime: 99.95, count: { enabled: true, limit: 3, counter: 3 } }),
    );
    expect(d.action).toBe(ACTIONS.PAUSE);
  });

  it('plays the next video when a finite count is exhausted on a playlist', () => {
    const d = decideLoop(
      state({
        currentTime: 99.95,
        count: { enabled: true, limit: 3, counter: 3 },
        playlistContinue: true,
      }),
    );
    expect(d.action).toBe(ACTIONS.NEXT);
  });

  it('keeps looping while count remains', () => {
    const d = decideLoop(
      state({ currentTime: 99.95, count: { enabled: true, limit: 3, counter: 1 } }),
    );
    expect(d.action).toBe(ACTIONS.RESTART);
  });
});

describe('decideLoop — portion', () => {
  const portion = { enabled: true, start: 10, end: 50 };

  it('restarts at the portion start when the end is reached', () => {
    const d = decideLoop(state({ portion, currentTime: 50 }));
    expect(d.action).toBe(ACTIONS.RESTART);
    expect(d.seekTo).toBe(10);
  });

  it('rewinds when playback sits before the start', () => {
    const d = decideLoop(state({ portion, currentTime: 5 }));
    expect(d.action).toBe(ACTIONS.RESTART);
    expect(d.seekTo).toBe(10);
  });

  it('polls just before the portion end', () => {
    expect(decideLoop(state({ portion, currentTime: 49.5 })).action).toBe(ACTIONS.POLL);
  });

  it('does nothing in the middle of the portion', () => {
    expect(decideLoop(state({ portion, currentTime: 30 })).action).toBe(ACTIONS.NONE);
  });

  it('stays paused at the start once the count is exhausted', () => {
    const d = decideLoop(
      state({
        portion,
        currentTime: 50,
        count: { enabled: true, limit: 2, counter: 2 },
      }),
    );
    expect(d.action).toBe(ACTIONS.RESTART_PAUSED);
    expect(d.seekTo).toBe(10);
  });
});

describe('decideLoop — timer', () => {
  it('jumps back and pauses when the timer elapses', () => {
    const d = decideLoop(
      state({
        currentTime: 40,
        portion: { enabled: false, start: 0, end: 0 },
        timer: { enabled: true, limit: 10, elapsed: 10 },
      }),
    );
    expect(d.action).toBe(ACTIONS.RESTART_PAUSED);
    expect(d.seekTo).toBe(0);
  });

  it('disables the timer when playback never advanced', () => {
    const d = decideLoop(
      state({
        currentTime: 0,
        timer: { enabled: true, limit: 10, elapsed: 10 },
      }),
    );
    expect(d.disableTimer).toBe(true);
  });
});

describe('decideLoop — recovery', () => {
  it('restarts when the player reports unstarted', () => {
    const d = decideLoop(state({ playerState: -1, currentTime: 0 }));
    expect(d.action).toBe(ACTIONS.RESTART);
  });
});
