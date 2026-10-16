/*
 * Settings — reads the user's options from localStorage.
 *
 * The content-script bridge mirrors chrome.storage.sync into localStorage via
 * window.postMessage({type:'optionsMsg'}), so this is the single read point.
 */

import { SETTING_KEYS, QUALITY_LEVELS } from '../constants.js';

const VALID_BUTTON_STYLES = ['all', 'icon', 'text'];

export class Settings {
  constructor(store = localStorage) {
    this.store = store;
  }

  get debug() {
    return this.store.getItem(SETTING_KEYS.debug) === 'true';
  }

  setDebug(enabled) {
    if (enabled) this.store.setItem(SETTING_KEYS.debug, 'true');
    else this.store.removeItem(SETTING_KEYS.debug);
  }

  /** 'false' | 'true' | 'saveState' */
  get autoLoopMode() {
    return this.store.getItem(SETTING_KEYS.autoLoop) || 'false';
  }

  get autoLoop() {
    return this.autoLoopMode === 'true';
  }

  get saveStateLoop() {
    return this.autoLoopMode === 'saveState';
  }

  /** 'all' | 'icon' | 'text' */
  get buttonStyle() {
    const v = this.store.getItem(SETTING_KEYS.buttonStyle);
    return VALID_BUTTON_STYLES.includes(v) ? v : 'all';
  }

  get showButtonIcon() {
    return this.buttonStyle !== 'text';
  }

  get showButtonText() {
    return this.buttonStyle !== 'icon';
  }

  /** Whether the advanced panel should be shown. */
  get showPanel() {
    return this.store.getItem(SETTING_KEYS.showPanel) === 'true';
  }

  get shortcutEnabled() {
    return this.store.getItem(SETTING_KEYS.shortcut) === 'true';
  }

  get shortcutKey() {
    const k = this.store.getItem(SETTING_KEYS.shortcutKey);
    return k && /^[a-z]$/.test(k) ? k : 'p';
  }

  /** A quality level, 'default', or 'disabled'. */
  get quality() {
    const v = this.store.getItem(SETTING_KEYS.quality);
    if (v === 'default' || QUALITY_LEVELS.includes(v)) return v;
    return 'disabled';
  }

  get hideInfo() {
    return this.store.getItem(SETTING_KEYS.hideInfo) === 'true';
  }

  set hideInfo(value) {
    if (value) this.store.setItem(SETTING_KEYS.hideInfo, 'true');
    else this.store.removeItem(SETTING_KEYS.hideInfo);
  }

  /** Saved loop state from a previous visit (for "save state" auto-loop). */
  get previousLoopState() {
    return this.store.getItem(SETTING_KEYS.loopState) === 'true';
  }

  set previousLoopState(value) {
    this.store.setItem(SETTING_KEYS.loopState, value ? 'true' : 'false');
  }

  /** Per-playlist { [playlistId]: { count, timer } } records. */
  get playlistRecords() {
    try {
      const parsed = JSON.parse(this.store.getItem(SETTING_KEYS.playlists));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* ignore */
    }
    return {};
  }

  set playlistRecords(records) {
    this.store.setItem(SETTING_KEYS.playlists, JSON.stringify(records));
  }
}
