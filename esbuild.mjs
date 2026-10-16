/*
 * Build script for Looper for YouTube.
 *
 * Produces a loadable MV3 extension in dist/:
 *   - script.js        content script (isolated world) -> injects the page script
 *   - contentscript.js page script (MAIN world)        -> all of the logic
 *   - everything in public/ copied verbatim (manifest, options, locales, assets)
 */
import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

const entries = [
  { in: 'src/injector.js', out: 'script.js' },
  { in: 'src/index.js', out: 'contentscript.js' },
];

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await cp('public', outdir, { recursive: true });

const options = {
  entryPoints: entries.map((e) => ({ in: e.in, out: e.out.replace(/\.js$/, '') })),
  outdir,
  bundle: true,
  format: 'iife',
  target: ['chrome111'],
  platform: 'browser',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[looper] watching for changes...');
} else {
  await build(options);
  console.log('[looper] build complete -> dist/');
  if (!existsSync(`${outdir}/manifest.json`)) {
    console.warn('[looper] warning: dist/manifest.json missing');
  }
}
