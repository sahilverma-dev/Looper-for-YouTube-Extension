/*
 * Player adapter.
 *
 * This is the ONLY module allowed to act on YouTube's player. It centralises:
 *   - resolving a *fresh* player element (the old code held stale references
 *     that survived SPA navigation and could target the miniplayer).
 *   - suspending all player actions while the miniplayer is active.
 *
 * Deliberately absent: stopVideo(). The extension never stops YouTube's video,
 * because doing so on a non-watch page is what kills the miniplayer.
 */

import { IDS } from '../constants.js';
import { isMiniplayerActive } from './miniplayer.js';

export class PlayerAdapter {
  /**
   * @param {() => boolean} [isSuspended] extra gate (e.g. extension torn down)
   */
  constructor(isSuspended = () => false) {
    this._isSuspended = isSuspended;
  }

  /** Fresh player element, or null when unavailable / we must keep hands off. */
  element() {
    const el = document.getElementById(IDS.player) || document.querySelector('.html5-video-player');
    return el || null;
  }

  /** True when player actions are currently allowed. */
  canAct() {
    if (this._isSuspended()) return false;
    if (isMiniplayerActive()) return false;
    return true;
  }

  isReady() {
    const el = this.element();
    return !!(el && typeof el.getDuration === 'function');
  }

  currentTime() {
    const el = this.element();
    return el && typeof el.getCurrentTime === 'function' ? el.getCurrentTime() : 0;
  }

  duration() {
    const el = this.element();
    return el && typeof el.getDuration === 'function' ? el.getDuration() : 0;
  }

  /** -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
  state() {
    const el = this.element();
    return el && typeof el.getPlayerState === 'function' ? el.getPlayerState() : -1;
  }

  play() {
    if (!this.canAct()) return false;
    const el = this.element();
    if (el && typeof el.playVideo === 'function') {
      el.playVideo();
      return true;
    }
    return false;
  }

  pause() {
    if (!this.canAct()) return false;
    const el = this.element();
    if (el && typeof el.pauseVideo === 'function') {
      el.pauseVideo();
      return true;
    }
    return false;
  }

  seekTo(seconds, allowSeekAhead = true) {
    if (!this.canAct()) return false;
    const el = this.element();
    if (el && typeof el.seekTo === 'function') {
      el.seekTo(seconds, allowSeekAhead);
      return true;
    }
    return false;
  }

  /** Play the next item (playlists). */
  next() {
    if (!this.canAct()) return false;
    const el = this.element();
    if (el && typeof el.nextVideo === 'function') {
      el.nextVideo();
      return true;
    }
    return false;
  }

  /** Pause, jump to `seconds` and resume — the normal loop restart. */
  restart(seconds) {
    if (!this.canAct()) return false;
    this.pause();
    this.seekTo(seconds, true);
    this.play();
    return true;
  }

  /** Read the playback quality currently in use (or false). */
  quality() {
    const el = this.element();
    return el && typeof el.getPlaybackQuality === 'function' ? el.getPlaybackQuality() : false;
  }
}
