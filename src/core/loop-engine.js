/*
 * Loop engine — pure decision logic.
 *
 * Given a snapshot of the player and the user's loop settings it returns the
 * single action to take. Keeping this DOM-free means every boundary case can
 * be unit-tested without a browser.
 */

export const ACTIONS = {
  /** Nothing to do. */
  NONE: 'none',
  /** Not enough information yet (duration 0). */
  IGNORE: 'ignore',
  /** Near a boundary — re-evaluate shortly for precision. */
  POLL: 'poll',
  /** Restart playback from `seekTo`. */
  RESTART: 'restart',
  /** Jump to `seekTo` and stay paused. */
  RESTART_PAUSED: 'restart-paused',
  /** Move to the next video (playlist continue). */
  NEXT: 'next',
  /** Pause playback. */
  PAUSE: 'pause',
}

/**
 * @typedef {Object} LoopState
 * @property {number} duration
 * @property {number} currentTime
 * @property {number} playerState   -1 unstarted, 0 ended, 1 playing, 2 paused…
 * @property {{enabled:boolean,start:number,end:number}} portion
 * @property {{enabled:boolean,limit:number,counter:number}} count
 * @property {{enabled:boolean,limit:number,elapsed:number}} timer
 * @property {boolean} playlistContinue
 *
 * @returns {{action:string, seekTo?:number, incrementCounter?:boolean,
 *            stopAutoplay?:boolean, disableTimer?:boolean}}
 */
export function decideLoop(state) {
  const {
    duration = 0,
    currentTime = 0,
    playerState = -1,
    portion = { enabled: false, start: 0, end: 0 },
    count = { enabled: false, limit: 0, counter: 0 },
    timer = { enabled: false, limit: 0, elapsed: 0 },
    playlistContinue = false,
  } = state;

  if (!duration || duration <= 0) return { action: ACTIONS.IGNORE };

  const countAllowsMore = !count.enabled || count.limit > count.counter;

  // --- Loop inside a portion ------------------------------------------------
  if (portion.enabled && playerState > -1) {
    const reachedEnd = currentTime >= portion.end || portion.start > currentTime + 0.1;
    if (reachedEnd) {
      if (countAllowsMore) {
        return {
          action: ACTIONS.RESTART,
          seekTo: portion.start,
          incrementCounter: !(portion.start >= currentTime),
        };
      }
      return playlistContinue
        ? { action: ACTIONS.NEXT }
        : { action: ACTIONS.RESTART_PAUSED, seekTo: portion.start };
    }
    if (currentTime >= portion.end - 1) return { action: ACTIONS.POLL };
    return { action: ACTIONS.NONE };
  }

  // --- Loop on a minute timer ----------------------------------------------
  if (timer.enabled && timer.elapsed >= timer.limit) {
    if (currentTime > portion.start) {
      return playlistContinue
        ? { action: ACTIONS.NEXT }
        : { action: ACTIONS.RESTART_PAUSED, seekTo: portion.start, stopAutoplay: true };
    }
    return { action: ACTIONS.NONE, disableTimer: true };
  }

  // --- Normal end-of-video loop --------------------------------------------
  if (playerState > -1 && currentTime >= duration - 0.1) {
    if (countAllowsMore) {
      return { action: ACTIONS.RESTART, seekTo: 0, incrementCounter: true, stopAutoplay: true };
    }
    if (count.enabled) {
      return playlistContinue
        ? { action: ACTIONS.NEXT }
        : { action: ACTIONS.PAUSE, stopAutoplay: true };
    }
  }
  if (currentTime >= duration - 1) return { action: ACTIONS.POLL };

  // --- Recovery: player reported "unstarted" --------------------------------
  if (playerState === -1) {
    return { action: ACTIONS.RESTART, seekTo: portion.start || 0 };
  }

  // --- Recovery: clock stuck at zero while ended ----------------------------
  if (currentTime === 0 && playerState === 0) {
    return { action: ACTIONS.RESTART, seekTo: portion.start || 0 };
  }

  return { action: ACTIONS.NONE };
}
