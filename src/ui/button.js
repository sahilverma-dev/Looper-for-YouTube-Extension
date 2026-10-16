/*
 * Loop button — the "Loop" control injected into the watch action bar.
 *
 * IMPORTANT: the button is a plain <div> + <button>, NOT a YouTube custom
 * element. Earlier versions wrapped it in <ytd-button-renderer>/<yt-button-shape>;
 * YouTube's Polymer upgrades those elements and stamps its own template, which
 * wipes any children we inserted — leaving an empty, invisible button. Using
 * plain elements means nothing can re-render our contents away.
 *
 * The inner <button> carries YouTube's current native button classes so it
 * inherits the real pill styling, and inject_style.css drives icon/text
 * visibility from the `.loop-button` classes.
 */

import { IDS } from '../constants.js';

/** Native YouTube pill-button classes (as used by Share / Download / Save). */
const BUTTON_CLASSES = [
  'ytSpecButtonShapeNextHost',
  'ytSpecButtonShapeNextTonal',
  'ytSpecButtonShapeNextMono',
  'ytSpecButtonShapeNextSizeM',
  'ytSpecButtonShapeNextIconLeading',
  'ytSpecButtonShapeNextEnableBackdropFilterExperiment',
  'ytSpecButtonShapeNextMainstageIconSize',
  'ytSpecButtonShapeNextMainstagePadding',
].join(' ');

/** The loop glyph, plus the small A / ✔ / state labels. */
function buildIcon() {
  const iconContainer = document.createElement('span');
  iconContainer.className = 'icon-container ytIconWrapperHost';
  iconContainer.style.width = '24px';
  iconContainer.style.height = '24px';

  const labels = document.createElement('span');
  labels.className = 'label-container';
  for (const [cls, text] of [
    ['auto', 'A'],
    ['disabled', ''],
    ['enabled', '✔'],
  ]) {
    const label = document.createElement('label');
    label.className = cls;
    label.innerText = text;
    labels.appendChild(label);
  }

  const icon = document.createElement('div');
  icon.className = 'yt-icon-container style-scope ytd-button-renderer';
  icon.style.cssText = 'width:100%;height:100%;display:block;fill:currentcolor;';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('height', '24');
  svg.setAttribute('width', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'pointer-events:none;display:inherit;width:100%;height:100%;';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M21,13h1v5L3.93,18.03l2.62,2.62l-0.71,0.71L1.99,17.5l3.85-3.85l0.71,0.71l-2.67,2.67L21,17V13z ' +
      'M3,7l17.12-0.03 l-2.67,2.67l0.71,0.71l3.85-3.85l-3.85-3.85l-0.71,0.71l2.62,2.62L2,6v5h1V7z',
  );
  svg.appendChild(path);
  icon.appendChild(svg);

  iconContainer.appendChild(labels);
  iconContainer.appendChild(icon);
  return iconContainer;
}

/** The inner <button>, matching YouTube's own markup. */
export function buildButtonContent(i18n, _settings) {
  const label = i18n.t('button_text') || 'Loop';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.className = BUTTON_CLASSES;

  // Icon and text are always present; inject_style.css shows/hides them from
  // the `.button-show-icon` / `.button-show-text` classes on the wrapper.
  const icon = document.createElement('div');
  icon.setAttribute('aria-hidden', 'true');
  icon.className = 'ytSpecButtonShapeNextIcon ytSpecButtonShapeNextElevatedContent';
  icon.appendChild(buildIcon());
  button.appendChild(icon);

  const text = document.createElement('div');
  text.id = 'text';
  text.className = 'ytSpecButtonShapeNextButtonTextContent';
  text.setAttribute('aria-label', label);
  text.innerText = label;
  button.appendChild(text);

  return button;
}

/**
 * Mount (or re-mount) the loop button inside `container`.
 * @returns {HTMLElement} the plain wrapper element
 */
export function mountButton(container, { i18n, settings, onClick }) {
  if (!container) return null;

  document.getElementById(IDS.button)?.remove();

  const root = document.createElement('div');
  root.setAttribute('id', IDS.button);
  root.setAttribute('class', 'loop-button');
  root.appendChild(buildButtonContent(i18n, settings));
  root.addEventListener('click', onClick);

  container.appendChild(root);
  return root;
}

/** Rebuild the button's inner content (e.g. after a language change). */
export function refreshButtonContent(root, i18n, settings) {
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);
  root.appendChild(buildButtonContent(i18n, settings));
}

/** Reflect looping / auto-loop / icon-text state on the wrapper. */
export function updateButtonState(root, { looping, autoLoop, settings }) {
  if (!root) return;
  root.classList.toggle('loop-auto', autoLoop);
  root.classList.toggle('loop-enabled', looping);
  root.classList.toggle('loop-disabled', !looping);
  root.classList.toggle('button-show-icon', settings.showButtonIcon);
  root.classList.toggle('button-show-text', settings.showButtonText);
}
