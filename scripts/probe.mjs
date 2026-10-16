/*
 * Read-only DOM probe: dumps the watch-page action bar structure, YouTube's own
 * button markup, and our injected button so we can match the native styling.
 *
 * Run: node scripts/probe.mjs
 */
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const dist = resolve('dist');

function findChromium() {
  const base = join(process.env.HOME, 'Library/Caches/ms-playwright');
  for (const dir of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
    const mac = join(base, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(mac)) return mac;
  }
  return null;
}

const context = await chromium.launchPersistentContext(join(tmpdir(), `looper-probe-${Date.now()}`), {
  executablePath: findChromium(),
  headless: false,
  args: [
    '--headless=new',
    ...(process.env.LOOPER_NO_EXT ? [] : [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]),
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
  ],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const trim = (s, n = 1400) => (s.length > n ? s.slice(0, n) + '\n…[truncated]' : s);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const describe = (el) =>
    el
      ? { tag: el.tagName, id: el.id || null, cls: (el.className || '').toString().slice(0, 200), box: box(el) }
      : null;

  const row = document.querySelector('#top-level-buttons-computed');
  const parentChain = [];
  for (let el = row; el && parentChain.length < 4; el = el.parentElement) {
    parentChain.push(describe(el));
  }

  // YouTube's own buttons in the row (excluding ours)
  const kids = [...(row?.children || [])];
  const nativeButtons = kids
    .filter((c) => c.id !== 'loop-button')
    .map((c) => ({
      ...describe(c),
      innerButton: describe(c.querySelector('button')),
      innerButtonCls: c.querySelector('button')?.className?.toString(),
      text: c.innerText?.trim()?.slice(0, 40),
    }));

  // A complete native button markup sample (for cloning/reference)
  const nativeSample = kids.find((c) => c.id !== 'loop-button' && c.querySelector('button'));

  // Other action-bar containers YouTube uses
  const containers = [
    '#top-level-buttons-computed',
    '#flexible-item-buttons',
    '#actions',
    '#menu',
    'ytd-menu-renderer',
    '#owner',
    'ytd-watch-metadata #actions-inner',
  ].map((sel) => ({ sel, found: !!document.querySelector(sel), n: document.querySelectorAll(sel).length }));

  const loop = document.getElementById('loop-button');
  const loopInner = loop?.querySelector('button');

  // Every action button YouTube rendered inside the watch metadata block.
  const actionButtons = [...document.querySelectorAll('ytd-watch-metadata button')]
    .map((b) => ({
      text: (b.innerText || '').trim().slice(0, 24),
      id: b.closest('[id]')?.id || null,
      box: box(b),
      visible: !!b.offsetParent && b.getBoundingClientRect().width > 0,
    }))
    .filter((b) => b.box.w > 20 || b.id === 'loop-button');

  return {
    url: location.href,
    parentChain,
    nativeButtons,
    actionButtons,
    containers,
    nativeSampleHTML: nativeSample ? trim(nativeSample.outerHTML, 1800) : null,
    loopHTML: loop ? trim(loop.outerHTML, 1800) : null,
    loopInnerComputed: loopInner
      ? {
          cls: loopInner.className,
          background: getComputedStyle(loopInner).backgroundColor,
          border: getComputedStyle(loopInner).border,
          borderRadius: getComputedStyle(loopInner).borderRadius,
          padding: getComputedStyle(loopInner).padding,
          height: getComputedStyle(loopInner).height,
          font: getComputedStyle(loopInner).font,
        }
      : null,
    nativeInnerComputed: nativeSample?.querySelector('button')
      ? {
          cls: nativeSample.querySelector('button').className,
          background: getComputedStyle(nativeSample.querySelector('button')).backgroundColor,
          border: getComputedStyle(nativeSample.querySelector('button')).border,
          borderRadius: getComputedStyle(nativeSample.querySelector('button')).borderRadius,
          padding: getComputedStyle(nativeSample.querySelector('button')).padding,
          height: getComputedStyle(nativeSample.querySelector('button')).height,
          font: getComputedStyle(nativeSample.querySelector('button')).font,
        }
      : null,
  };
});

// Same-page A/B: remove our button and re-read YouTube's action bar, so the
// comparison isn't confounded by a differently-rendered page between runs.
if (!process.env.LOOPER_NO_EXT) {
  await page.evaluate(() => document.getElementById('loop-button')?.remove());
  await page.waitForTimeout(1500);
  out.actionButtonsAfterRemoval = await page.evaluate(() =>
    [...document.querySelectorAll('ytd-watch-metadata button')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          text: (b.innerText || '').trim().slice(0, 24),
          host: b.closest('[id]')?.id || null,
          x: Math.round(r.x),
          w: Math.round(r.width),
        };
      })
      .filter((b) => b.w > 20),
  );
}

console.log(JSON.stringify(out, null, 2));
await page.screenshot({ path: process.env.LOOPER_NO_EXT ? 'probe-noext.png' : 'probe.png' }).catch(() => {});
await context.close();
