/*
 * Auto quality (Auto HD/4K/8K).
 *
 * Mirrors the original behaviour: pick the requested level, clamped to what the
 * video actually offers, retry a few times because YouTube applies quality
 * asynchronously, and fall back to writing `yt-player-quality` in localStorage.
 */

import { QUALITY_LEVELS } from '../constants.js';

const MAX_ATTEMPTS = 5;

export class QualityController {
  /**
   * @param {import('../platform/player.js').PlayerAdapter} player
   * @param {import('../core/settings.js').Settings} settings
   */
  constructor(player, settings) {
    this.player = player;
    this.settings = settings;
    this.timer = null;
    this.attempts = 0;
  }

  /** Start (or re-start) trying to apply the user's quality preference. */
  apply() {
    clearTimeout(this.timer);
    this.attempts = 0;
    this.#step();
  }

  #step = () => {
    const wanted = this.settings.quality;
    if (wanted === 'disabled') return;

    const available = this.#available();
    if (!available.length) {
      this.#retry();
      return;
    }

    const current = this.#current();
    const target = this.#clamp(wanted, available);

    if (target === current) {
      // Nothing to do.
      clearTimeout(this.timer);
      return;
    }

    const el = this.player.element();
    if (!el) {
      this.#retry();
      return;
    }
    if (typeof el.setPlaybackQualityRange === 'function') {
      el.setPlaybackQualityRange([target]);
    } else if (typeof el.setPlaybackQuality === 'function') {
      el.setPlaybackQuality(target);
    }

    this.#remember(target);
    this.#retry();
  };

  #retry() {
    this.attempts += 1;
    if (this.attempts > MAX_ATTEMPTS) {
      clearTimeout(this.timer);
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(this.#step, 1000);
  }

  #current() {
    return this.player.quality();
  }

  #available() {
    const el = this.player.element();
    if (el && typeof el.getAvailableQualityLevels === 'function') {
      const levels = el.getAvailableQualityLevels();
      if (levels && levels.length) return levels;
    }
    return [];
  }

  /** Clamp the requested level into the available range. */
  #clamp(wanted, available) {
    if (wanted === 'default') return available[0];
    const wantedIndex = QUALITY_LEVELS.indexOf(wanted);
    const best = available[0];
    const worst = available[available.length - 1];
    if (QUALITY_LEVELS.indexOf(best) > wantedIndex) return best;
    if (QUALITY_LEVELS.indexOf(worst) < wantedIndex) return worst;
    return wanted;
  }

  #remember(level) {
    try {
      const stored = localStorage.getItem('yt-player-quality');
      if (!stored || stored.indexOf(level) === -1) {
        const creation = Date.now();
        localStorage.setItem(
          'yt-player-quality',
          JSON.stringify({ data: level, expiration: creation + 2592000000, creation }),
        );
      }
    } catch {
      /* storage may be unavailable */
    }
  }
}
