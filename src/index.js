/*
 * Looper for YouTube — page script (entry point).
 *
 * Wiring only: it builds the modules, runs one debounced init path per
 * navigation, and tears the UI down when leaving a watch page WITHOUT touching
 * YouTube's player (that is what used to break the miniplayer).
 */

import { SESSION_KEYS, SETTING_KEYS, BRIDGE_KEYS, IDS } from './constants.js';
import { Settings } from './core/settings.js';
import { SessionState } from './core/session.js';
import { I18n } from './core/i18n.js';
import { LoopController } from './core/loop-controller.js';
import { PlayerAdapter } from './platform/player.js';
import { isWatchPage } from './platform/miniplayer.js';
import { mountButton, refreshButtonContent, updateButtonState } from './ui/button.js';
import { LoopPanel } from './ui/panel.js';
import { QualityController } from './features/quality.js';
import { readAutoplay, setAutoplay, dismissUpNext } from './features/autoplay.js';
import { formatTime, parseTime } from './util/time.js';
import { getUrlVar, rewriteUrl, hadParamOnLoad } from './util/url.js';

(function () {
  'use strict';

  const initialSearch = window.location.search;

  const settings = new Settings();
  const session = new SessionState();
  const i18n = new I18n(sessionStorage.getItem(BRIDGE_KEYS.chromePage) || '');
  const inIncognito = sessionStorage.getItem(BRIDGE_KEYS.inIncognito) === 'true';

  let active = false;
  const player = new PlayerAdapter(() => !active);
  const quality = new QualityController(player, settings);

  let button = null;
  let panel = null;
  let readyTimer = null;
  let initTimer = null;
  let autoplayListenerAttached = false;
  let urlApplied = false;
  let currentVideoId = null;

  // --- extension facade (consumed by the panel & controller) ----------------

  const app = {
    settings,
    session,
    i18n,
    inIncognito,
    controller: null,
    get optionPage() {
      const base = sessionStorage.getItem(BRIDGE_KEYS.chromePage) || '';
      return base ? base + 'options.html' : null;
    },
    isLooping: () => session.getBool(SESSION_KEYS.looping),
    currentTime: () => player.currentTime(),
    duration: () => player.duration(),
    portion: () => session.getPortion(0),
    setPortion: (field, value) => session.setPortion(0, { [field]: value }),
    replaceUrlVar: (name, value) => {
      window.history.replaceState(null, '', rewriteUrl(window.location.href, name, value));
    },
    checkAutoplay,
    hasPlaylist: () => getUrlVar('list', window.location.search) != null,
  };

  const controller = new LoopController(
    { player, session, settings },
    {
      onUpdate: () => refreshUi(),
      stopAutoplay: dismissUpNext,
      readAutoplay,
      playlistId: () => getUrlVar('list', window.location.search),
    },
  );
  app.controller = controller;

  function checkAutoplay() {
    const initial = session.getBool(SESSION_KEYS.autoplayInitial);
    setAutoplay(app.isLooping() ? false : initial);
  }

  // --- init / routing -------------------------------------------------------

  function scheduleInit({ fresh = false, delay = 0 } = {}) {
    clearTimeout(initTimer);
    initTimer = setTimeout(() => init({ fresh }), delay);
  }

  function init({ fresh }) {
    if (!document.body) return;
    if (!isWatchPage()) {
      teardown();
      return;
    }

    active = true;
    document.body.classList.add('ytl-2026');

    if (fresh) {
      const videoId = getUrlVar('v', window.location.search);
      if (videoId !== currentVideoId) {
        currentVideoId = videoId;
        session.reset();
        urlApplied = false;
        autoplayListenerAttached = false;
      }
      removeUi();
    }

    wireGlobalListeners();
    wireUrlLoopOnce();
    startReadyLoop();
  }

  function startReadyLoop() {
    clearInterval(readyTimer);
    let attempts = 0;
    readyTimer = setInterval(() => {
      attempts += 1;
      if (mountUi() || attempts > 100) {
        clearInterval(readyTimer);
        maybeStartLoop();
      }
    }, 100);
  }

  /** Mount (or reconcile) the button + panel. Returns true when ready. */
  function mountUi() {
    if (!active) return false;
    const buttonContainer = document.querySelector(IDS.buttonContainer);
    if (!buttonContainer) return false;

    if (!document.getElementById(IDS.button)) {
      button = mountButton(buttonContainer, { i18n, settings, onClick: onButtonClick });
    }

    const panelContainer = document.querySelector(IDS.panelContainer);
    if (panelContainer && !document.getElementById(IDS.panel)) {
      panel = new LoopPanel(app);
      panelContainer.insertBefore(panel.build(), panelContainer.firstChild);
    }

    refreshUi();
    return true;
  }

  function removeUi() {
    document.getElementById(IDS.button)?.remove();
    document.getElementById(IDS.panel)?.remove();
    button = null;
    panel = null;
  }

  function maybeStartLoop() {
    if (settings.quality !== 'disabled') quality.apply();

    const restore = settings.saveStateLoop && settings.previousLoopState;
    if ((restore || settings.autoLoop) && !app.isLooping() && player.isReady()) {
      startLoop();
    } else {
      session.setBool(SESSION_KEYS.loopAutoclick, false);
    }
  }

  /**
   * Leaving a watch page: drop our UI and listeners. We deliberately do NOT
   * call stopVideo() or touch the player, so the miniplayer keeps playing.
   */
  function teardown() {
    clearInterval(readyTimer);
    controller.detach();
    controller.stopTimer();
    removeUi();
    active = false;
  }

  // --- loop control ---------------------------------------------------------

  function startLoop() {
    controller.start();
    if (settings.showPanel) panel?.show();
    refreshUi();
    window.postMessage({ type: 'loopActionDone' }, '*');
  }

  function stopLoop() {
    controller.stop();
    panel?.hide();
    quality.apply();
    refreshUi();
  }

  function onButtonClick(e) {
    if (e && e.which === 2) return;
    if (app.isLooping() && settings.showPanel && panel && !panel.visible) {
      panel.show();
    } else if (app.isLooping()) {
      stopLoop();
    } else {
      startLoop();
    }
    session.setBool(SESSION_KEYS.loopAutoclick, false);
  }

  function refreshUi() {
    if (button) {
      updateButtonState(button, { looping: app.isLooping(), autoLoop: settings.autoLoop, settings });
    }
    panel?.update();
  }

  // --- URL-driven loop ------------------------------------------------------

  function wireUrlLoopOnce() {
    if (urlApplied) return;
    if (!player.isReady()) return;
    urlApplied = true;

    const search = window.location.search;
    const urlLoopCount = Number(getUrlVar('loop', search) || 0);
    const urlTimer = Number(getUrlVar('timer', search) || 0);
    const hasStart = hadParamOnLoad('start', initialSearch);
    const hasEnd = hadParamOnLoad('end', initialSearch);

    if (urlLoopCount > 0) {
      session.set(SESSION_KEYS.loopCount, urlLoopCount);
      session.setBool(SESSION_KEYS.loopInCount, true);
    }
    if (urlTimer > 0) {
      session.set(SESSION_KEYS.loopTimer, urlTimer);
      session.setBool(SESSION_KEYS.loopInTimer, true);
    }
    if (hasStart || hasEnd) {
      const duration = player.duration();
      if (hasStart) {
        let t = Math.floor(parseTime(getUrlVar('start', search) || '0'));
        if (t >= duration) t = 0;
        app.setPortion('start', t);
        session.setBool(SESSION_KEYS.loopInPortion, true);
      }
      if (hasEnd) {
        let t = Math.floor(parseTime(getUrlVar('end', search) || '0'));
        if (!t || t > duration) t = Math.floor(duration);
        app.setPortion('end', t);
        session.setBool(SESSION_KEYS.loopInPortion, true);
      }
    }

    const shouldAutoStart = urlLoopCount > 0 || urlTimer > 0 || hasStart || hasEnd;
    if (shouldAutoStart && !app.isLooping() && !settings.autoLoop) {
      session.setBool(SESSION_KEYS.loopAutoclick, true);
      startLoop();
    }
  }

  // --- global listeners -----------------------------------------------------

  function wireGlobalListeners() {
    if (autoplayListenerAttached) return;
    const toggle = document.querySelector(
      'ytd-compact-autoplay-renderer paper-toggle-button, #autoplay-checkbox',
    );
    if (!toggle) return;
    toggle.addEventListener('change', () => {
      if (app.isLooping()) onButtonClick();
    });
    autoplayListenerAttached = true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (!settings.shortcutEnabled) return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target;
      if (target) {
        const tag = target.localName;
        if (tag === 'input' || tag === 'textarea') return;
        if (target.hasAttribute && target.hasAttribute('contenteditable')) return;
        if (target.getAttribute && target.getAttribute('role') === 'textbox') return;
      }
      const key = e.key ? e.key.toLowerCase() : '';
      if (key === settings.shortcutKey || key === 'r') onButtonClick();
    },
    false,
  );

  // --- options bridge -------------------------------------------------------

  function applyOptionsMessage(data) {
    const store = localStorage;
    if (data.key !== undefined) store.setItem(SETTING_KEYS.shortcut, data.key ? 'true' : 'false');
    if (data.shortcutKey !== undefined) {
      const sk = typeof data.shortcutKey === 'string' && /^[a-z]$/.test(data.shortcutKey) ? data.shortcutKey : 'p';
      store.setItem(SETTING_KEYS.shortcutKey, sk);
    }
    if (data.auto !== undefined) {
      store.setItem(SETTING_KEYS.autoLoop, ['true', 'false', 'saveState'].includes(data.auto) ? data.auto : 'false');
    }
    if (data.button !== undefined) {
      store.setItem(SETTING_KEYS.buttonStyle, ['all', 'icon', 'text'].includes(data.button) ? data.button : 'all');
      if (button) refreshButtonContent(button, i18n, settings);
    }
    if (data.panel !== undefined) {
      store.setItem(SETTING_KEYS.showPanel, data.panel ? 'true' : 'false');
    }
    if (data.quality !== undefined) {
      store.setItem(SETTING_KEYS.quality, data.quality);
      quality.apply();
    }
    if (data.oldchrome !== undefined) {
      document.getElementById('options-page-link')?.style.setProperty('display', 'none');
      document.getElementById('loop-panel-tips-container')?.style.setProperty('display', 'none');
    }
    refreshUi();
    maybeStartLoop();
  }

  window.addEventListener(
    'message',
    (e) => {
      if (e.source !== window || !e.data || typeof e.data.type !== 'string') return;
      if (e.data.type === 'optionsMsg') {
        if (!/^https?:\/\/([a-z0-9-]+\.)*youtube\.com$/.test(e.origin)) return;
        applyOptionsMessage(e.data);
      } else if (e.data.type === 'resetHidePromotion') {
        settings.hideInfo = false;
      }
    },
    false,
  );

  // --- navigation -----------------------------------------------------------

  document.addEventListener('yt-navigate-finish', () => scheduleInit({ fresh: true, delay: 0 }));
  document.addEventListener('yt-page-data-updated', () => scheduleInit({ fresh: false, delay: 50 }));

  async function boot() {
    await i18n.load(document.documentElement.getAttribute('lang') || navigator.language || 'en');
    scheduleInit({ fresh: true, delay: 0 });
    window.postMessage({ type: 'requestMessage' }, '*');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Expose a tiny debug handle (only when explicitly enabled).
  if (settings.debug) {
    window.__looper = { app, controller, player, settings, session, i18n };
  }
})();
