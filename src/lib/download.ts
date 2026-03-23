/**
 * Safe blob download utility.
 *
 * Defers `URL.revokeObjectURL` via `setTimeout` so the browser has time to
 * initiate the download before the blob URL is invalidated. Without the
 * deferral, `anchor.click()` (which is async under the hood) can race with
 * the revocation and produce 0-byte files in some browsers.
 */

const REVOKE_DELAY_MS = 150;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
