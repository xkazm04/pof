/**
 * Viewer load-state vocabulary + the one place a loader failure becomes a sentence.
 *
 * `SceneViewer` loads through `GLTFLoader.load`, whose error callback used to end at a
 * `console.error` — so a 404, a bad `?dir=` or a corrupt mesh left the studio blank with
 * no state anywhere and no way back. These types/helpers are pure so the three states are
 * testable without a WebGL canvas.
 */

/**
 * Which of the three things is true of the viewport right now.
 *
 * `idle` means "no model asked for" — it is NOT the same as "asked for and blank", which
 * is exactly the conflation the empty `THREE.Group` used to ship.
 */
export type ViewerLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Fallback wording when a loader rejects with nothing legible attached. */
export const UNKNOWN_LOAD_ERROR = 'the loader failed without reporting a reason';

/**
 * Turn whatever `GLTFLoader`/`fetch` rejected with into one reportable line. Never returns
 * an empty string — an unexplained failure must still say that it failed.
 */
export function describeLoadError(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
    const t = (error as { type?: unknown }).type;
    if (typeof t === 'string' && t.trim()) return `loader reported "${t}"`;
  }
  return UNKNOWN_LOAD_ERROR;
}
