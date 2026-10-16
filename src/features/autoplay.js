/*
 * Autoplay handling.
 *
 * While looping we turn YouTube's autoplay toggle off and restore it
 * afterwards, and dismiss the "up next" overlay when a loop restarts.
 */

export function findAutoplayToggle() {
  const compact = document.getElementsByTagName('ytd-compact-autoplay-renderer')[0];
  if (compact) {
    const toggle = compact.getElementsByTagName('paper-toggle-button')[0];
    if (toggle) return toggle;
  }
  return document.getElementById('autoplay-checkbox') || null;
}

export function readAutoplay() {
  const toggle = findAutoplayToggle();
  return toggle ? !!toggle.checked : false;
}

export function setAutoplay(enabled) {
  const toggle = findAutoplayToggle();
  if (toggle) toggle.checked = enabled;
}

/** Dismiss the "up next" overlay so it can't steal the loop. */
export function dismissUpNext() {
  const click = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: false,
  });
  for (const cls of ['ytp-upnext-cancel-button', 'ytp-upnext-close-button']) {
    const el = document.getElementsByClassName(cls)[0];
    if (el) el.dispatchEvent(click);
  }
}
