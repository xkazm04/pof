/**
 * The one place that knows how a drain's rendered L4 frame (an absolute filesystem
 * path in `DrainSummary.screenshots`) becomes something a browser can load: the
 * path-jailed `GET /api/pipeline-artifacts/drain/frame` route.
 *
 * Kept pure + relative-URL (repo law: client calls use `/api/...`) so both the batch
 * drain summary and any future frame surface build the same link.
 */
export const DRAIN_FRAME_ENDPOINT = '/api/pipeline-artifacts/drain/frame';

/** Relative URL that serves the captured frame at `absPath`. */
export function drainFrameUrl(absPath: string): string {
  return `${DRAIN_FRAME_ENDPOINT}?path=${encodeURIComponent(absPath)}`;
}

/** The trailing file name of a frame path — a short, honest caption/alt for a thumbnail. */
export function drainFrameLabel(absPath: string): string {
  const parts = absPath.replace(/\\/g, '/').split('/').filter(Boolean);
  const file = parts[parts.length - 1] ?? absPath;
  const dir = parts[parts.length - 2];
  // A scenario capture writes `pof_l4_scn_<stamp>/shot_03.png` — the bare `shot_03.png`
  // is ambiguous across runs, so keep its directory when there is one.
  return dir ? `${dir}/${file}` : file;
}
