/*
 * Miniplayer detection.
 *
 * YouTube's miniplayer moves #movie_player into a <ytd-miniplayer> host. While
 * that is active the extension must not touch the player at all: pausing,
 * seeking, restarting or writing layout styles fights the miniplayer
 * transition and is exactly what used to break it.
 */

export function isMiniplayerActive(doc = document) {
  if (!doc || typeof doc.querySelector !== 'function') return false;

  // Explicit active state on the miniplayer host.
  if (doc.querySelector('ytd-miniplayer[active]')) return true;

  const player = doc.getElementById('movie_player');
  if (player) {
    // The player lives inside the miniplayer host while minimised.
    if (typeof player.closest === 'function' && player.closest('ytd-miniplayer')) {
      return true;
    }
    if (player.classList && player.classList.contains('ytp-miniplayer')) {
      return true;
    }
  }

  return false;
}

/** True when the page outside the miniplayer should host the loop UI. */
export function isWatchPage(doc = document) {
  if (!doc || typeof doc.querySelector !== 'function') return false;
  return !!(
    doc.querySelector('ytd-watch-flexy') ||
    doc.querySelector('ytd-watch') ||
    doc.getElementById('movie_player')
  );
}
