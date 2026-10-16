/*
 * Session state — typed access to the per-tab values the loop lives in.
 * Wraps sessionStorage so the rest of the code never touches raw strings.
 */

import { SESSION_KEYS, SESSION_DEFAULTS } from '../constants.js';

export class SessionState {
  constructor(store = sessionStorage) {
    this.store = store;
  }

  /** Restore every key to its default (called on each (re)initialisation). */
  reset() {
    for (const [key, value] of Object.entries(SESSION_DEFAULTS)) {
      this.store.setItem(key, String(value));
    }
  }

  getString(key) {
    const raw = this.store.getItem(key);
    return raw == null ? '' : raw;
  }

  getBool(key) {
    return this.store.getItem(key) === 'true';
  }

  getNumber(key) {
    return Number(this.store.getItem(key) || 0);
  }

  set(key, value) {
    this.store.setItem(key, String(value));
  }

  setBool(key, value) {
    this.store.setItem(key, value ? 'true' : 'false');
  }

  /** Read a numeric field that must be > 0 or fall back to a default. */
  getPositive(key, fallback = 0) {
    const n = this.getNumber(key);
    return n > 0 ? n : fallback;
  }

  /** The [ {start,end} ] portion range. */
  getPortion(index = 0) {
    let list = [];
    try {
      list = JSON.parse(this.getString(SESSION_KEYS.portion));
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    const entry = list[index] || {};
    return {
      start: 'start' in entry ? parseFloat(entry.start) : 0,
      end: 'end' in entry ? parseFloat(entry.end) : 0,
    };
  }

  setPortion(index, { start, end }) {
    let list = [];
    try {
      list = JSON.parse(this.getString(SESSION_KEYS.portion));
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    const current = list[index] || {};
    const next = { ...current };
    if (start !== undefined) next.start = start;
    if (end !== undefined) next.end = end;
    if (Object.keys(next).length === 0) next.start = 0;
    while (list.length <= index) list.push({});
    list[index] = next;
    this.store.setItem(SESSION_KEYS.portion, JSON.stringify(list));
  }
}
