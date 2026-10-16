/*
 * URL helpers — reading and rewriting query parameters without disturbing
 * YouTube's own params. Pure string functions (unit-tested); the live
 * extension supplies window.location/history.
 */

/** Read a single query parameter from a search string. */
export function getUrlVar(name, search) {
  return new URLSearchParams(search).get(name);
}

/**
 * Return `href` with a query parameter set, replaced or removed.
 * - value === null/undefined/'undefined' removes the parameter.
 * - otherwise the parameter is set (added when missing).
 */
export function rewriteUrl(href, name, value) {
  const url = new URL(href);
  if (value == null || value === 'undefined') {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

/**
 * True when the query parameter exists, has a value > 0 and was already
 * present when the page first loaded (i.e. part of the shared URL rather than
 * added by the extension while looping).
 */
export function hadPositiveParamOnLoad(name, initialSearch, currentSearch) {
  const initial = Number(getUrlVar(name, initialSearch) || 0);
  if (initial > 0) return true;
  const current = Number(getUrlVar(name, currentSearch) || 0);
  return current > 0;
}

/** True when the parameter was present (non-null) at page load. */
export function hadParamOnLoad(name, initialSearch) {
  return getUrlVar(name, initialSearch) != null;
}
