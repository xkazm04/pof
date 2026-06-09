import { describe, it, expect } from 'vitest';
import {
  formatGateMessage, buildWebhookBody, gateChangeHeadline,
  type GateVerdictChangedPayload,
} from '@/lib/notify/webhook-payload';

const regression: GateVerdictChangedPayload = {
  catalogId: 'items', entityId: 'sword-01', step: 'L3 Runtime Gate', tier: 'L3',
  from: 'pass', to: 'fail', regression: true, detail: 'VSItemsTest: 2 failed',
};
const recovery: GateVerdictChangedPayload = {
  catalogId: 'materials', entityId: 'mat-1', step: 'Visual', tier: 'L4',
  from: 'deferred', to: 'pass', regression: false, detail: 'render OK',
};

describe('gateChangeHeadline', () => {
  it('labels a regression distinctly from a plain failure', () => {
    expect(gateChangeHeadline(regression).label).toBe('Gate regression');
    expect(gateChangeHeadline({ ...regression, regression: false }).label).toBe('Gate failed');
    expect(gateChangeHeadline(recovery).label).toBe('Gate passed');
  });
});

describe('formatGateMessage', () => {
  it('includes where, the transition, and the detail', () => {
    const msg = formatGateMessage(regression);
    expect(msg).toContain('items/sword-01');
    expect(msg).toContain('L3 Runtime Gate (L3)');
    expect(msg).toContain('pass → fail');
    expect(msg).toContain('VSItemsTest: 2 failed');
  });

  it('renders a null prior as "none"', () => {
    const msg = formatGateMessage({ ...regression, from: null });
    expect(msg).toContain('none → fail');
  });
});

describe('buildWebhookBody', () => {
  it('uses Slack `text`', () => {
    const body = buildWebhookBody('slack', regression);
    expect(body).toHaveProperty('text');
    expect(typeof body.text).toBe('string');
    expect(body).not.toHaveProperty('content');
  });

  it('uses Discord `content`', () => {
    const body = buildWebhookBody('discord', regression);
    expect(body).toHaveProperty('content');
    expect(body).not.toHaveProperty('text');
  });

  it('uses a generic envelope carrying the raw payload', () => {
    const body = buildWebhookBody('generic', regression);
    expect(body.event).toBe('gate.verdict.changed');
    expect(body.payload).toEqual(regression);
    expect(typeof body.message).toBe('string');
  });
});
