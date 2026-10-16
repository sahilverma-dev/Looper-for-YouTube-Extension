/*
 * End-to-end smoke test for Looper for YouTube.
 *
 * Loads the built extension (dist/) into Chromium, serves a YouTube-like watch
 * page, and reports:
 *   - console errors / uncaught page errors
 *   - which chrome-extension:// resources were actually requested
 *   - whether the loop button + panel mounted
 *   - whether the injector -> page-script options handshake worked
 *   - whether clicking the button starts the loop
 *
 * Run: node scripts/e2e.mjs
 */
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const dist = resolve('dist');

function findChromium() {
  const base = join(process.env.HOME, 'Library/Caches/ms-playwright');
  if (!existsSync(base)) return null;
  for (const dir of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
    const mac = join(base, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(mac)) return mac;
    const linux = join(base, dir, 'chrome-linux/chrome');
    if (existsSync(linux)) return linux;
  }
  return null;
}

const FIXTURE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>watch fixture</title></head>
<body>
<ytd-app><ytd-watch-flexy>
  <div id="player"><div id="player-container">
    <div id="movie_player" class="html5-video-player">
      <video class="video-stream html5-main-video"></video>
    </div>
  </div></div>
</ytd-watch-flexy></ytd-app>

<div id="content"><div id="above-the-fold">
  <div id="top-level-buttons-computed"></div>
  <div id="bottom-row"></div>
</div></div>

<ytd-compact-autoplay-renderer><paper-toggle-button></paper-toggle-button></ytd-compact-autoplay-renderer>

<script>
  const p = document.getElementById('movie_player');
  const video = document.querySelector('.video-stream');
  let t = 12, state = 1;
  p.getDuration = () => 100;
  p.getCurrentTime = () => t;
  p.getPlayerState = () => state;
  p.playVideo = () => { state = 1; window.__played = (window.__played || 0) + 1; };
  p.pauseVideo = () => { state = 2; window.__paused = (window.__paused || 0) + 1; };
  p.seekTo = (s) => { t = s; window.__seeks = (window.__seeks || 0) + 1; window.__lastSeek = s; };
  p.nextVideo = () => { window.__next = true; };
  p.getPlaybackQuality = () => 'hd1080';
  p.getAvailableQualityLevels = () => ['hd1080','hd720','large','medium','small'];
  p.setPlaybackQualityRange = () => {};
  p.setPlaybackQuality = () => {};
  window.__fixtureReady = true;
  document.dispatchEvent(new Event('yt-navigate-finish'));
</script>
</body></html>`;

const executablePath = findChromium();
if (!executablePath) {
  console.error('No cached Chromium found.');
  process.exit(2);
}
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/manifest.json missing — run `npm run build` first.');
  process.exit(2);
}

const consoleLogs = [];
const pageErrors = [];
const extRequests = [];
const failedRequests = [];

const userDataDir = join(tmpdir(), `looper-e2e-${Date.now()}`);

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  args: [
    '--headless=new',
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
  ],
});

const page = context.pages()[0] ?? (await context.newPage());

page.on('console', (m) => {
  const type = m.type();
  if (type === 'error' || type === 'warning') consoleLogs.push(`[console.${type}] ${m.text()}`);
});
page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith('chrome-extension://')) extRequests.push(u.split('/').slice(3).join('/') || u);
});
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));

// LOOPER_CSP lets us replay a strict page CSP (like YouTube's script-src).
const csp = process.env.LOOPER_CSP;
const headers = csp ? { 'content-security-policy': csp } : {};

// LOOPER_REAL=1 talks to the real youtube.com instead of the fixture.
const real = process.env.LOOPER_REAL === '1';
if (!real) {
  await page.route(/^https:\/\/(www\.|m\.)?youtube\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers, body: FIXTURE }),
  );
}

const report = { ok: true, checks: {}, mode: real ? 'real' : 'fixture', csp: csp || null };

await page.goto(real ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 'https://www.youtube.com/watch?v=TESTVIDEOID', {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
});

// Give the extension time to boot, load locales, handshake and mount.
await page.waitForTimeout(4000);

report.checks.buttonMounted = await page.evaluate(() => !!document.getElementById('loop-button'));
report.checks.panelMounted = await page.evaluate(() => !!document.getElementById('action-panel-loop'));
report.checks.ytlBodyClass = await page.evaluate(() => document.body.classList.contains('ytl-2026'));

report.button = await page.evaluate(() => {
  const b = document.getElementById('loop-button');
  if (!b) return null;
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cs = getComputedStyle(b);
  const inner = b.querySelector('button');
  const parent = b.parentElement;
  return {
    childElementCount: b.children.length,
    innerHTMLLength: b.innerHTML.length,
    hasButton: !!inner,
    hasText: !!b.querySelector('#text'),
    textContent: b.querySelector('#text')?.textContent ?? null,
    hasIcon: !!b.querySelector('.icon-container'),
    rect: rect(b),
    innerRect: inner ? rect(inner) : null,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    position: cs.position,
    parentTag: parent ? parent.tagName + (parent.id ? '#' + parent.id : '') : null,
    parentRect: parent ? rect(parent) : null,
    parentChildCount: parent ? parent.children.length : 0,
    visibleInViewport: rect(b).w > 0 && rect(b).h > 0 && rect(b).y >= 0 && rect(b).y < window.innerHeight,
  };
});

report.panel = await page.evaluate(() => {
  const p = document.getElementById('action-panel-loop');
  if (!p) return null;
  const cs = getComputedStyle(p);
  return { classes: p.className, display: cs.display, opacity: cs.opacity, childCount: p.children.length };
});

report.localStorage = await page.evaluate(() =>
  Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('yt-') || k.startsWith('ytl-'))),
);
report.sessionStorage = await page.evaluate(() =>
  Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => k.startsWith('yt-') || k === 'chromePage' || k === 'inIncognito')),
);

// Click the loop button if it mounted, then check the loop actually started.
if (report.checks.buttonMounted) {
  await page.click('#loop-button button').catch(() => page.click('#loop-button').catch(() => {}));
  await page.waitForTimeout(1500);
  report.sessionStorageAfterClick = await page.evaluate(() =>
    Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => k.startsWith('yt-'))),
  );
  report.playerCalls = await page.evaluate(() => ({
    seeks: window.__seeks || 0,
    lastSeek: window.__lastSeek,
    played: window.__played || 0,
    paused: window.__paused || 0,
  }));
}

report.extensionResources = [...new Set(extRequests)].sort();
report.consoleLogs = [...new Set(consoleLogs)];
report.pageErrors = pageErrors;
report.failedRequests = failedRequests;

report.checks.handshakeWorked = report.localStorage['yt-loop-options'] === 'true';
report.checks.pageScriptRan = report.extensionResources.some((r) => r.includes('contentscript.js'));

report.ok =
  report.checks.buttonMounted &&
  report.checks.pageScriptRan &&
  report.pageErrors.length === 0;

const shotPath = real ? 'e2e-real.png' : 'e2e-fixture.png';
await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
report.screenshot = shotPath;

console.log(JSON.stringify(report, null, 2));

await context.close();
process.exit(report.ok ? 0 : 1);
