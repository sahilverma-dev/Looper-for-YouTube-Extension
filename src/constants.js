/*
 * Looper for YouTube
 * Copyright (c) 2011-2026, AlvinHKH — https://alvinhkh.com
 * All rights reserved.
 *
 * Central constants: storage keys, defaults, DOM ids and quality levels.
 */

/** Keys written to sessionStorage (per-tab, per-session). */
export const SESSION_KEYS = {
  duration: 'yt-duration',
  playerSize: 'yt-player-size',
  playerSizeInitial: 'yt-player-size-initial',
  looping: 'yt-loop',
  loopAttached: 'yt-loop-attached',
  loopAutoclick: 'yt-loop-autoclick',
  loopCount: 'yt-loop-count',
  loopCounter: 'yt-loop-th',
  loopTime: 'yt-loop-time',
  loopTimer: 'yt-loop-timer',
  loopInCount: 'yt-loop-incount',
  loopInPortion: 'yt-loop-inportion',
  loopInTimer: 'yt-loop-intimer',
  playlistEndPlay: 'yt-loop-playlist-endplay',
  portion: 'yt-loop-portion',
  autoplayInitial: 'yt-autoplay-initial',
  qualitySet: 'yt-quality-set',
};

/** Default session values (mirrors the original initialiseVariables). */
export const SESSION_DEFAULTS = {
  [SESSION_KEYS.duration]: 0,
  [SESSION_KEYS.playerSize]: 'normal',
  [SESSION_KEYS.playerSizeInitial]: 'normal',
  [SESSION_KEYS.looping]: false,
  [SESSION_KEYS.loopAttached]: false,
  [SESSION_KEYS.loopAutoclick]: false,
  [SESSION_KEYS.loopCount]: 10,
  [SESSION_KEYS.loopCounter]: 0,
  [SESSION_KEYS.loopTime]: 0,
  [SESSION_KEYS.loopTimer]: 10,
  [SESSION_KEYS.loopInCount]: false,
  [SESSION_KEYS.loopInPortion]: false,
  [SESSION_KEYS.loopInTimer]: false,
  [SESSION_KEYS.playlistEndPlay]: false,
  [SESSION_KEYS.portion]: JSON.stringify([]),
};

/** Keys read/written in localStorage (mirrors the original setting names). */
export const SETTING_KEYS = {
  debug: 'yt-loop-debug',
  autoLoop: 'yt-auto-loop',
  buttonStyle: 'yt-loop-button',
  showPanel: 'yt-loop-options',
  shortcut: 'yt-loop-shortcut',
  shortcutKey: 'yt-loop-shortcut-key',
  quality: 'yt-quality',
  playlists: 'yt-loop-playlist',
  loopState: 'yt-loop',
  hideInfo: 'ytl-hide-information',
};

/** Session keys owned by the content-script bridge (set before the page script runs). */
export const BRIDGE_KEYS = {
  chromePage: 'chromePage',
  inIncognito: 'inIncognito',
};

/** DOM ids / class hooks used by the injected UI. */
export const IDS = {
  button: 'loop-button',
  panel: 'action-panel-loop',
  panelDismiss: 'action-panel-dismiss',
  buttonContainer: '#content #above-the-fold #top-level-buttons-computed',
  panelContainer: '#content #above-the-fold #bottom-row',
  player: 'movie_player',
};

/** Ordered best -> worst, used to compare/set playback quality. */
export const QUALITY_LEVELS = [
  'highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080',
  'hd720', 'large', 'medium', 'small', 'tiny',
];

export const MAX_LOOP_COUNT = 999;
export const MAX_LOOP_MINUTES = 1440;
export const PLAYLIST_RECORD_LIMIT = 1000;
