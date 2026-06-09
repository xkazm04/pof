// Pure payload formatting for the gate-verdict webhook (no I/O). Turns a
// `gate.verdict.changed` event into a human message and the per-target request
// body (Slack `{ text }`, Discord `{ content }`, or a generic JSON envelope).

import type { EventPayload } from '@/types/event-bus';

export type GateVerdictChangedPayload = EventPayload<'gate.verdict.changed'>;

/** Where the webhook posts to — decides the JSON body shape. */
export type GateNotifyTarget = 'slack' | 'discord' | 'generic';

export const GATE_NOTIFY_TARGETS: readonly GateNotifyTarget[] = ['slack', 'discord', 'generic'];

/** A short, classified headline for the change (drives emoji + first line). */
export function gateChangeHeadline(p: GateVerdictChangedPayload): { emoji: string; label: string } {
  if (p.regression) return { emoji: '🔴', label: 'Gate regression' };
  if (p.to === 'fail') return { emoji: '🟠', label: 'Gate failed' };
  if (p.to === 'pass') return { emoji: '🟢', label: 'Gate passed' };
  return { emoji: '🔵', label: 'Gate verdict changed' };
}

/** Human-readable, single-block message used as the webhook text/content. */
export function formatGateMessage(p: GateVerdictChangedPayload): string {
  const { emoji, label } = gateChangeHeadline(p);
  const where = `${p.catalogId}/${p.entityId} · ${p.step} (${p.tier})`;
  const transition = `${p.from ?? 'none'} → ${p.to}`;
  const detail = p.detail ? `\n${p.detail}` : '';
  return `${emoji} ${label} — ${where}\n${transition}${detail}`;
}

/** Build the request body for the configured webhook target. */
export function buildWebhookBody(
  target: GateNotifyTarget,
  p: GateVerdictChangedPayload,
): Record<string, unknown> {
  const text = formatGateMessage(p);
  switch (target) {
    case 'slack':
      return { text };
    case 'discord':
      return { content: text };
    case 'generic':
    default:
      return { event: 'gate.verdict.changed', message: text, payload: p };
  }
}
