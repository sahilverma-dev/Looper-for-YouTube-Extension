/*
 * Looper for YouTube — content script (isolated world).
 *
 * Injects the page script, mirrors chrome.storage.sync into the page via
 * window.postMessage({type:'optionsMsg'}), and exposes sessionStorage flags the
 * page script needs.
 */

const CHANGELOG_URL = 'https://www.alvinhkh.com/looperforyoutube/changelog/updated';

// --- changelog on update ----------------------------------------------------
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  const thisVersion = chrome.runtime.getManifest().version;
  chrome.storage.local.get(['yt-loop-version'], (result) => {
    if (result['yt-loop-version'] === thisVersion) return;
    chrome.storage.local.set({ 'yt-loop-version': thisVersion });
    chrome.storage.sync.get(['option_show_changelog'], (sync) => {
      if (sync['option_show_changelog'] !== 'false' && sync['option_show_changelog'] !== false) {
        window.open(CHANGELOG_URL, 'changelogWindow');
      }
    });
  });
}

// --- inject the page script -------------------------------------------------
const pageScript = document.createElement('script');
pageScript.src = chrome.runtime.getURL('contentscript.js');
pageScript.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(pageScript);

// --- options bridge ---------------------------------------------------------
function postOptions() {
  if (!chrome.storage) {
    window.postMessage(
      {
        type: 'optionsMsg',
        auto: false,
        button: 'all',
        key: true,
        shortcutKey: 'p',
        panel: true,
        quality: 'disabled',
        show_changelog: true,
        oldchrome: true,
      },
      '*',
    );
    return;
  }
  chrome.storage.sync.get(null, (value) => {
    window.postMessage(
      {
        type: 'optionsMsg',
        auto: value['ytAutoLoop'] ? value['ytAutoLoop'] : false,
        button: value['option_button'] ? value['option_button'] : 'all',
        key: value['ytShortcut'] ? value['ytShortcut'] !== 'false' : true,
        shortcutKey:
          value['ytShortcutKey'] && /^[a-z]$/i.test(value['ytShortcutKey'])
            ? value['ytShortcutKey'].toLowerCase()
            : 'p',
        panel: value['ytLoopPanel'] ? value['ytLoopPanel'] !== 'false' : true,
        quality: value['ytQuality'] ? value['ytQuality'] : 'disabled',
        show_changelog: value['option_show_changelog'] ? value['option_show_changelog'] !== 'false' : true,
      },
      '*',
    );
  });
}

if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes) => {
    for (const key of Object.keys(changes)) {
      const change = changes[key];
      const option = { type: 'optionsMsg' };
      switch (key) {
        case 'ytAutoLoop':
          option.auto = ['true', 'false', 'saveState'].includes(change.newValue) ? change.newValue : 'false';
          break;
        case 'option_button':
          option.button = ['all', 'icon', 'text'].includes(change.newValue) ? change.newValue : 'all';
          break;
        case 'ytShortcut':
          option.key = change.newValue !== 'false';
          break;
        case 'ytShortcutKey':
          option.shortcutKey =
            change.newValue && /^[a-z]$/i.test(change.newValue) ? change.newValue.toLowerCase() : 'p';
          break;
        case 'ytLoopPanel':
          option.panel = change.newValue !== 'false';
          break;
        case 'ytQuality':
          option.quality = change.newValue || 'disabled';
          break;
        case 'option_show_changelog':
          option.show_changelog = change.newValue !== 'false';
          break;
        default:
          continue;
      }
      window.postMessage(option, '*');
    }
  });
  postOptions();
}

// --- session flags for the page script --------------------------------------
sessionStorage['chromePage'] = chrome.runtime ? chrome.runtime.getURL('') : '';
sessionStorage['inIncognito'] = chrome.extension ? chrome.extension.inIncognitoContext : false;

window.addEventListener(
  'message',
  (e) => {
    if (e.source !== window || !e.data || typeof e.data.type !== 'string') return;
    if (e.data.type === 'requestMessage') postOptions();
  },
  false,
);
