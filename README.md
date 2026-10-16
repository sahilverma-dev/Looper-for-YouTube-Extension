# Looper for YouTube — rewrite

A from-scratch, modular rewrite of the **Looper for YouTube** Chrome extension
(v5.18.2), with one specific goal in mind: **YouTube's miniplayer must keep
working.**

> **Not published on the Chrome Web Store.** This is a personal rewrite. It is
> not, and will not be, listed on the Chrome Web Store — install it locally by
> loading the unpacked build (see [Build / test / load](#build--test--load)).

## Why this exists

The Chrome Web Store version of Looper for YouTube (5.18.2) broke YouTube for
me: the miniplayer stopped working, and the Loop button rendered wrong or
vanished. There was no upstream fix and no sign of one coming, so this is a
from-scratch rewrite that keeps the features I actually use and fixes the
playback handling at the root rather than patching around it.

---

## The bug

With the original extension enabled, the miniplayer failed in two ways:

1. **It opened, but the video stopped / went black.**
2. **It died when navigating away from the watch page.**

Both trace back to the page script (`contentscript.js`) reaching into YouTube's
player in ways that are incompatible with the miniplayer:

| Cause | Original code |
|---|---|
| Called `player.stopVideo()` on any **non-watch** page — exactly where the miniplayer lives | `contentscript.js:2400`, `:2442` |
| Held a **stale `player` reference** that survived SPA navigation, so it targeted the reparented miniplayer video | `getVariable('player')`, `player_reference` |
| Forced `stopVideo → seekTo → playVideo` while the player was being reparented | `contentscript.js:1896-1906` |
| Re-ran full `initiate()` (resetting loop state) on `yt-page-data-updated`, which fires during the miniplayer transition | `contentscript.js:2464-2467` |

The miniplayer's whole purpose is playback *away from* the watch page, so an
extension that "cleans up" by stopping the video is directly hostile to it.

### Second bug: the Loop button rendered wrong / vanished

The button was built as a `<ytd-button-renderer>` wrapping a `<yt-button-shape>`.
Both are **YouTube custom elements**: Polymer upgrades them and stamps its own
template, wiping the `<button>` we inserted. A few seconds after mount the
element was reduced to:

```html
<ytd-button-renderer id="loop-button" class="loop-button …" button-renderer="" button-next="">
  <!--css-build:shady-->
  <yt-button-shape></yt-button-shape>          <!-- our <button> was destroyed -->
  <tp-yt-paper-tooltip …></tp-yt-paper-tooltip>
</ytd-button-renderer>
```

Because the wipe is asynchronous, the button appeared briefly and then
disappeared — an intermittent "sometimes it's there, sometimes not".

Today's YouTube action buttons are not `ytd-button-renderer` at all; they are a
plain `<button class="ytSpecButtonShapeNextHost …">` inside `yt-button-view-model`.
**The fix: build the button from plain elements only** — a `<div id="loop-button">`
wrapper containing a native-classed `<button>`. Nothing YouTube can re-render,
and it picks up YouTube's real pill styling (`rgba(0,0,0,.05)`, 20px radius,
40px tall) instead of the browser's default button chrome.

## The fix (architectural, not a spot patch)

- **`stopVideo()` does not exist anywhere.** The extension never stops YouTube's
  video. Leaving a watch page tears down the loop UI and listeners only.
- **`PlayerAdapter` (`src/platform/player.js`) is the only module allowed to
  touch the player.** It re-resolves `#movie_player` on every call (no stale
  nodes) and every action is gated by `canAct()`.
- **Miniplayer-aware suspension** (`src/platform/miniplayer.js`): while
  `isMiniplayerActive()` is true, every player action is a no-op.
- **One debounced init path.** `yt-navigate-finish` = fresh init (new video);
  `yt-page-data-updated` = light refresh that never resets loop state.

## Architecture

```
src/
  constants.js              storage keys, defaults, DOM ids, quality levels
  util/time.js              formatTime / parseTime            (unit-tested)
  util/url.js               query param read/rewrite          (unit-tested)
  core/settings.js          localStorage options
  core/session.js           typed sessionStorage state
  core/i18n.js              _locales/<lang>/messages.json loader
  core/loop-engine.js       pure loop decisions               (unit-tested)
  core/loop-controller.js   applies decisions to the player
  platform/miniplayer.js    isMiniplayerActive / isWatchPage   (unit-tested)
  platform/player.js        the ONLY player access point
  ui/button.js              the loop button
  ui/panel.js               count / portion / playlist panel
  features/quality.js       Auto HD/4K/8K
  features/autoplay.js      autoplay toggle + "up next" dismissal
  index.js                  orchestrator + options bridge (built to contentscript.js)
  injector.js               content script (built to script.js)
public/                     manifest, options page, locales, CSS, icon
tests/                      vitest unit tests
dist/                       loadable extension (build output)
```

## Build / test / load

```bash
npm install
npm test          # vitest — 35 unit tests
npm run build     # -> dist/
npm run watch     # rebuild on change
```

### Browser harnesses (need the cached Chromium from Playwright)

```bash
npm run test:e2e              # load dist/ + serve a YouTube-like watch page, assert mount/click
LOOPER_REAL=1 npm run test:e2e  # same assertions against real youtube.com + screenshot
npm run probe                 # dump YouTube's real action-bar markup/styling
```

`test:e2e` also supports `LOOPER_CSP="script-src 'self'"` to replay a strict page
CSP, and `LOOPER_NO_EXT=1` to boot the browser without the extension for A/B
comparison.

Then load it: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the `dist/` folder.

## What changed vs. the original

- **Removed dead code:** the player-size / `watch-full` layout manipulation
  (the content script never sends `playersize`, so it was unreachable), the
  flash-era `setVisitorCookies`, and the `watch7-container` paths.
- **Kept, reimplemented:** one-click loop, loop count, loop timer (debug),
  loop-in-portion with a draggable range, playlist continue-after-limit,
  auto-loop (on/off/save-state), URL params (`loop`, `timer`, `start`, `end`),
  keyboard shortcut, Auto quality, i18n, options sync, debug flag.
- **Reused assets:** `_locales/*`, `options.css`, `options_input.css`,
  `inject_style.css`, and the icon — styling and assets, not logic.

## Credits

Looper for YouTube was originally created by **AlvinHKH** and published on the
Chrome Web Store. The original idea, the feature set, and the UI are his work.
This repository is an independent, from-scratch rewrite of that extension, and
is not affiliated with or endorsed by the original author.

## Testing checklist (manual)

Miniplayer enter/exit/navigate/restore × loop on/off × auto-loop × portion ×
count × timer × playlist. Success = the miniplayer never breaks **and** every
feature above still works.
