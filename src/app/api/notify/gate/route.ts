import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getGateNotifyConfig, setGateNotifyConfig, getGateNotifyState,
  type GateNotifyConfig,
} from '@/lib/notify/gate-notify-store';
import { dispatchGateNotification, recordGateNotifyOutcome } from '@/lib/notify/gate-notifier';
import { GATE_NOTIFY_MODES } from '@/lib/notify/verdict-change';
import { GATE_NOTIFY_TARGETS } from '@/lib/notify/webhook-payload';
import type { EventPayload } from '@/types/event-bus';

/** GET — current webhook config + last-send state for the settings UI. */
export async function GET() {
  try {
    return apiSuccess({ config: getGateNotifyConfig(), state: getGateNotifyState() });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'failed to read gate-notify config', 500);
  }
}

/** Validate a partial config from an untrusted body. Returns null on bad input. */
function sanitizeConfigPatch(body: Record<string, unknown>): Partial<GateNotifyConfig> | null {
  const patch: Partial<GateNotifyConfig> = {};
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return null;
    patch.enabled = body.enabled;
  }
  if ('webhookUrl' in body) {
    if (typeof body.webhookUrl !== 'string') return null;
    patch.webhookUrl = body.webhookUrl.trim();
  }
  if ('target' in body) {
    if (!GATE_NOTIFY_TARGETS.includes(body.target as never)) return null;
    patch.target = body.target as GateNotifyConfig['target'];
  }
  if ('mode' in body) {
    if (!GATE_NOTIFY_MODES.includes(body.mode as never)) return null;
    patch.mode = body.mode as GateNotifyConfig['mode'];
  }
  return patch;
}

/**
 * Why a webhook URL cannot be stored, or null when it is acceptable. The server fetches
 * it, so only a well-formed http(s) URL is kept; empty clears the webhook. A policy on
 * private/loopback hosts is deliberately NOT applied here (a local receiver is legitimate).
 */
function webhookUrlError(url: string): string | null {
  if (url === '') return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return 'webhookUrl must be an absolute http(s) URL'; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'webhookUrl must use http or https';
  return null;
}

/** A representative pass→fail regression used by the "Send test" button. */
const SAMPLE_PAYLOAD: EventPayload<'gate.verdict.changed'> = {
  catalogId: 'demo',
  entityId: 'sample-entity',
  step: 'L3 Runtime Gate',
  tier: 'L3',
  from: 'pass',
  to: 'fail',
  regression: true,
  detail: 'Test notification from PoF — gate-verdict webhook wiring is live.',
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid JSON body', 400);
  }
  // A body that is not a JSON object is the caller's error (400), never a saved empty patch.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return apiError('Request body must be a JSON object', 400);
  }
  const action = (body.action as string) ?? 'save';

  try {
    switch (action) {
      case 'save': {
        const patch = sanitizeConfigPatch(body);
        if (!patch) return apiError('invalid notify config fields', 400);
        const urlProblem = patch.webhookUrl === undefined ? null : webhookUrlError(patch.webhookUrl);
        if (urlProblem) return apiError(urlProblem, 400);
        return apiSuccess({ config: setGateNotifyConfig(patch) });
      }
      case 'test': {
        // Force-enable so an unsaved/disabled config can still be verified; a
        // regression sample clears every mode threshold. A URL is still required.
        const config = { ...getGateNotifyConfig(), enabled: true };
        if (!config.webhookUrl) return apiError('no webhook URL configured', 400);
        const outcome = await dispatchGateNotification(SAMPLE_PAYLOAD, config);
        recordGateNotifyOutcome(outcome);
        return apiSuccess({ outcome, state: getGateNotifyState() });
      }
      default:
        return apiError(`unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'gate-notify request failed', 500);
  }
}
