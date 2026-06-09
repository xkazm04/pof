// Server-only: the outbound webhook side of gate-verdict notifications. Subscribes
// to the typed `gate.verdict.changed` channel and POSTs to the configured webhook
// (Slack/Discord/generic) when a change clears the operator's threshold.
//
// The drain (drainOne) only *emits* the event — it never imports this file — so the
// notification concern stays fully decoupled from the runner. Registration happens
// once at server startup (src/instrumentation.ts), the same place the nightly-build
// cron registers.

import { eventBus } from '@/lib/event-bus';
import { logger } from '@/lib/logger';
import type { EventPayload } from '@/types/event-bus';
import { classifyVerdictChange, shouldNotify } from './verdict-change';
import { buildWebhookBody } from './webhook-payload';
import {
  getGateNotifyConfig,
  getGateNotifyState,
  setGateNotifyState,
  type GateNotifyConfig,
  type GateNotifySendStatus,
} from './gate-notify-store';

type GatePayload = EventPayload<'gate.verdict.changed'>;

export interface DispatchOutcome {
  status: GateNotifySendStatus;
  detail: string;
}

/**
 * POST the notification for one verdict change. Pure of persistence (writes no
 * state) so it can be unit-tested with an injected fetch. Skips — never throws —
 * when disabled, unconfigured, or below the configured threshold.
 */
export async function dispatchGateNotification(
  payload: GatePayload,
  config: GateNotifyConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchOutcome> {
  if (!config.enabled) return { status: 'skipped', detail: 'notifications disabled' };
  if (!config.webhookUrl) return { status: 'skipped', detail: 'no webhook URL configured' };

  const change = classifyVerdictChange(payload.from, payload.to);
  if (!shouldNotify(config.mode, change)) {
    return { status: 'skipped', detail: `change below '${config.mode}' threshold` };
  }

  try {
    const res = await fetchImpl(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWebhookBody(config.target, payload)),
    });
    if (!res.ok) return { status: 'error', detail: `webhook returned HTTP ${res.status}` };
    return { status: 'sent', detail: `notified ${config.target}` };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : 'webhook request failed' };
  }
}

/** Persist the outcome of a dispatch into the notify state (for the UI). */
export function recordGateNotifyOutcome(outcome: DispatchOutcome): void {
  const prev = getGateNotifyState();
  setGateNotifyState({
    lastSentAt: new Date().toISOString(),
    lastStatus: outcome.status,
    lastDetail: outcome.detail,
    sentCount: outcome.status === 'sent' ? prev.sentCount + 1 : prev.sentCount,
  });
}

/** Read live config, dispatch, and record the outcome. The convenience entry point. */
export async function notifyGateChange(
  payload: GatePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchOutcome> {
  const outcome = await dispatchGateNotification(payload, getGateNotifyConfig(), fetchImpl);
  recordGateNotifyOutcome(outcome);
  return outcome;
}

let unsubscribe: (() => void) | null = null;

/**
 * Subscribe the notifier to the event bus. Idempotent — safe to call once per
 * server process. The handler is fire-and-forget so a slow webhook never blocks
 * the drain loop that emitted the event.
 */
export function registerGateNotifier(): void {
  if (unsubscribe) return;
  unsubscribe = eventBus.on('gate.verdict.changed', (event) => {
    // Cheap early-out before any async work when the operator hasn't opted in.
    if (!getGateNotifyConfig().enabled) return;
    void notifyGateChange(event.payload).then((outcome) => {
      if (outcome.status === 'error') logger.warn(`[gate-notify] ${outcome.detail}`);
    }).catch((e) => {
      logger.warn(`[gate-notify] dispatch crashed: ${e instanceof Error ? e.message : String(e)}`);
    });
  });
  logger.info('[gate-notify] notifier registered');
}

/** Test-only: tear down the subscription so registration can be re-exercised. */
export function __resetGateNotifier(): void {
  unsubscribe?.();
  unsubscribe = null;
}
