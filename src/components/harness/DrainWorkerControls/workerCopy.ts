import type { DrainFilter } from '@/lib/test-gate-runner/drain';
import type { WorkerSettings } from './WorkerSettingsForm';

/**
 * Pure copy + body builders for the drain-worker panel. Kept out of the component so
 * the scope wording and the POST body are unit-testable and cannot drift from what the
 * toggle route actually accepts.
 */

/** Human scope of a worker filter — `{}` means every catalog at both runtime tiers. */
export function describeScope(filter: DrainFilter | undefined): string {
  if (!filter || Object.keys(filter).length === 0) return 'every catalog · L3+L4';
  const parts: string[] = [];
  parts.push(filter.catalogId ?? 'every catalog');
  if (filter.entityId) parts.push(filter.entityId);
  parts.push(filter.tier ?? 'L3+L4');
  return parts.join(' · ');
}

/**
 * The default is stated in the product, not only in the docs: an always-on process that
 * can drive (or boot) Unreal must never look like something the app decided on its own.
 */
export const AUTOSTART_DEFAULT_NOTE =
  'Boot-time auto-start is OFF by default. Set POF_DRAIN_WORKER_AUTOSTART=1 in the server environment to have this ' +
  'worker start with the app (POF_DRAIN_WORKER_INTERVAL_MS / _EXECUTOR / _TIER / _CATALOG tune it); the server logs ' +
  'the decision either way at boot. Starting it here is per-process and lasts until the server restarts.';

/** Body for `POST /api/pipeline-artifacts/drain/worker { action: 'start' }` — blanks omitted. */
export function startBody(s: WorkerSettings): Record<string, unknown> {
  const seconds = Number(s.intervalSeconds);
  const catalogId = s.catalogId.trim();
  return {
    action: 'start',
    ...(Number.isFinite(seconds) && seconds > 0 ? { intervalMs: Math.round(seconds * 1000) } : {}),
    executor: s.executor,
    ...(s.tier ? { tier: s.tier } : {}),
    ...(catalogId ? { catalogId } : {}),
  };
}
