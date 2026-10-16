/*
 * Loop controller — applies the pure engine's decisions to the player.
 *
 * Playlist-aware, timer-aware, and miniplayer-safe: every player action goes
 * through PlayerAdapter, which refuses to act while the miniplayer is active.
 */

import { ACTIONS, decideLoop } from './loop-engine.js';
import { SESSION_KEYS, PLAYLIST_RECORD_LIMIT } from '../constants.js';

export class LoopController {
  /**
   * @param {Object} deps
   * @param {import('../platform/player.js').PlayerAdapter} deps.player
   * @param {import('./session.js').SessionState} deps.session
   * @param {import('./settings.js').Settings} deps.settings
   * @param {Object} [hooks]
   */
  constructor({ player, session, settings }, hooks = {}) {
    this.player = player;
    this.session = session;
    this.settings = settings;
    this.hooks = hooks; // { onUpdate(), stopAutoplay(), playlistId() }

    this.playAction = null;
    this.timerInterval = null;
    this.videoEl = null;
    this._tick = this.tick.bind(this);
  }

  get looping() {
    return this.session.getBool(SESSION_KEYS.looping);
  }

  // --- lifecycle ------------------------------------------------------------

  start() {
    this.session.setBool(SESSION_KEYS.looping, true);
    this.settings.previousLoopState = true;
    this.session.set(SESSION_KEYS.loopCounter, 0);
    this.session.set(SESSION_KEYS.loopTime, 0);
    this.session.set(SESSION_KEYS.autoplayInitial, this.hooks.readAutoplay?.() || false);
    this.startTimer();
    this.attach();
    this.tick();
    this.hooks.onUpdate?.();
  }

  stop() {
    this.session.setBool(SESSION_KEYS.looping, false);
    this.settings.previousLoopState = false;
    this.stopTimer();
    this.detach();
    this.hooks.onUpdate?.();
  }

  attach() {
    const video = document.querySelector('.video-stream');
    this.videoEl = video || null;
    if (this.videoEl) {
      this.videoEl.removeEventListener('timeupdate', this._tick, false);
      this.videoEl.addEventListener('timeupdate', this._tick, false);
      this.videoEl.removeEventListener('ended', this._tick, false);
      this.videoEl.addEventListener('ended', this._tick, false);
    }
  }

  detach() {
    clearTimeout(this.playAction);
    if (this.videoEl) {
      this.videoEl.removeEventListener('timeupdate', this._tick, false);
      this.videoEl.removeEventListener('ended', this._tick, false);
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.player.state() === 1) {
        this.session.set(SESSION_KEYS.loopTime, this.session.getNumber(SESSION_KEYS.loopTime) + 1);
      }
      this.hooks.onUpdate?.();
      this.tick();
    }, 60000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  // --- the loop tick --------------------------------------------------------

  /** Snapshot fed to the pure engine. */
  snapshot() {
    const portion = this.session.getPortion(0);
    return {
      duration: this.player.duration(),
      currentTime: this.player.currentTime(),
      playerState: this.player.state(),
      portion: {
        enabled: this.session.getBool(SESSION_KEYS.loopInPortion),
        start: portion.start || 0,
        end: portion.end || 0,
      },
      count: {
        enabled: this.session.getBool(SESSION_KEYS.loopInCount),
        limit: this.session.getNumber(SESSION_KEYS.loopCount),
        counter: this.session.getNumber(SESSION_KEYS.loopCounter),
      },
      timer: {
        enabled: this.session.getBool(SESSION_KEYS.loopInTimer),
        limit: this.session.getNumber(SESSION_KEYS.loopTimer),
        elapsed: this.session.getNumber(SESSION_KEYS.loopTime),
      },
      playlistContinue: this.session.getBool(SESSION_KEYS.playlistEndPlay),
    };
  }

  tick() {
    clearTimeout(this.playAction);

    if (!this.looping) return;
    // Keep the duration / end bookkeeping fresh.
    this.syncDuration();

    const state = this.snapshot();
    const decision = decideLoop(state);

    switch (decision.action) {
      case ACTIONS.RESTART:
        if (decision.incrementCounter) this.incrementCounter();
        if (decision.stopAutoplay) this.hooks.stopAutoplay?.();
        this.player.restart(decision.seekTo ?? 0);
        break;

      case ACTIONS.RESTART_PAUSED:
        if (decision.stopAutoplay) this.hooks.stopAutoplay?.();
        this.player.pause();
        this.player.seekTo(decision.seekTo ?? 0, false);
        break;

      case ACTIONS.NEXT:
        this.player.next();
        break;

      case ACTIONS.PAUSE:
        if (decision.stopAutoplay) this.hooks.stopAutoplay?.();
        this.player.pause();
        break;

      case ACTIONS.POLL:
        // Re-check right before the boundary for a clean cut.
        this.playAction = setTimeout(this._tick, 20);
        break;

      case ACTIONS.IGNORE:
      case ACTIONS.NONE:
      default:
        break;
    }

    if (decision.disableTimer) this.session.setBool(SESSION_KEYS.loopInTimer, false);

    const changed = ![ACTIONS.IGNORE, ACTIONS.NONE, ACTIONS.POLL].includes(decision.action);
    if (changed || decision.disableTimer) this.hooks.onUpdate?.();
  }

  incrementCounter() {
    this.session.set(SESSION_KEYS.loopCounter, this.session.getNumber(SESSION_KEYS.loopCounter) + 1);
  }

  /** Keep session duration/end-time in step with the current video. */
  syncDuration() {
    const duration = this.player.duration();
    if (!duration) return;
    const storedDuration = this.session.getNumber(SESSION_KEYS.duration);
    const portion = this.session.getPortion(0);
    if (!portion.end || portion.end === storedDuration) {
      this.session.setPortion(0, { end: Math.floor(duration) });
    }
    if (storedDuration !== duration) {
      this.session.set(SESSION_KEYS.duration, duration);
    }
  }

  // --- playlist auto-loop records ------------------------------------------

  rememberPlaylist() {
    const playlistId = this.hooks.playlistId?.();
    if (!playlistId) return;
    if (!this.looping || !(this.session.getBool(SESSION_KEYS.loopInCount) || this.session.getBool(SESSION_KEYS.loopInTimer))) {
      this.forgetPlaylist();
      return;
    }
    let records = this.settings.playlistRecords;
    let keys = Object.keys(records);
    if (keys.length > PLAYLIST_RECORD_LIMIT) records = {};
    records[playlistId] = {};
    if (this.session.getBool(SESSION_KEYS.loopInCount)) {
      records[playlistId].count = this.session.getNumber(SESSION_KEYS.loopCount);
    }
    if (this.session.getBool(SESSION_KEYS.loopInTimer)) {
      records[playlistId].timer = this.session.getNumber(SESSION_KEYS.loopTimer);
    }
    this.settings.playlistRecords = records;
  }

  forgetPlaylist() {
    const playlistId = this.hooks.playlistId?.();
    if (!playlistId) return;
    const records = this.settings.playlistRecords;
    if (records[playlistId] !== undefined) {
      delete records[playlistId];
      this.settings.playlistRecords = records;
    }
  }
}
