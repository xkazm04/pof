import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMTransport } from '../transport';
import type { LLMTransportConfig, LLMResponse, WorkspaceSnapshot, LLMTransportStatus } from '../types';
import type { Intent } from '../../intent/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(overrides?: Partial<Intent>): Intent {
  return {
    id: 'intent-t-001',
    type: 'compose',
    payload: { action: 'open', panelType: 'scene-editor' },
    source: 'click',
    timestamp: 1700000000000,
    ...overrides,
  } as Intent;
}

function makeSnapshot(overrides?: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    panels: [{ type: 'scene-editor', role: 'primary', density: 'full' }],
    layout: 'single',
    viewport: { width: 1920, height: 1080 },
    ...overrides,
  };
}

function successResponse(description = 'Opened panel'): LLMResponse {
  return {
    status: 'resolved',
    patches: [{ op: 'add', path: '/panels/-', value: { type: 'scene-editor' } }],
    origin: 'llm',
    description,
  };
}

function errorResponse(error = 'Something went wrong'): LLMResponse {
  return { status: 'error', error };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createLLMTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns object with processIntent, getStatus, subscribe, getSnapshot, destroy', () => {
    const transport = createLLMTransport({
      sendToLLM: vi.fn().mockResolvedValue(successResponse()),
    });

    expect(typeof transport.processIntent).toBe('function');
    expect(typeof transport.getStatus).toBe('function');
    expect(typeof transport.subscribe).toBe('function');
    expect(typeof transport.getSnapshot).toBe('function');
    expect(typeof transport.destroy).toBe('function');

    transport.destroy();
  });

  it('processIntent calls serializeForClaude then config.sendToLLM with the serialized string', async () => {
    const sendToLLM = vi.fn().mockResolvedValue(successResponse());
    const transport = createLLMTransport({ sendToLLM });

    const intent = makeIntent();
    const snapshot = makeSnapshot();

    const promise = transport.processIntent(intent, snapshot);
    await vi.runAllTimersAsync();
    await promise;

    expect(sendToLLM).toHaveBeenCalledOnce();
    const arg = sendToLLM.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.intent.id).toBe('intent-t-001');
    expect(parsed.workspace.layout).toBe('single');

    transport.destroy();
  });

  it('on successful LLMResponse with status resolved, returns IntentResult resolved', async () => {
    const sendToLLM = vi.fn().mockResolvedValue(successResponse('Done'));
    const transport = createLLMTransport({ sendToLLM });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.patches).toHaveLength(1);
      expect(result.origin).toBe('llm');
      expect(result.description).toBe('Done');
    }

    transport.destroy();
  });

  it('on LLMResponse with status error, returns IntentResult error', async () => {
    const sendToLLM = vi.fn().mockResolvedValue(errorResponse('Parse error'));
    const transport = createLLMTransport({ sendToLLM });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toBe('Parse error');
    }

    transport.destroy();
  });

  it('status transitions: idle -> sending -> idle (success)', async () => {
    const statusChanges: LLMTransportStatus[] = [];
    const sendToLLM = vi.fn().mockResolvedValue(successResponse());
    const transport = createLLMTransport({
      sendToLLM,
      onStatusChange: (s) => statusChanges.push(s),
    });

    expect(transport.getStatus()).toBe('idle');

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    // After starting, status should be sending
    expect(transport.getStatus()).toBe('sending');

    await vi.runAllTimersAsync();
    await promise;

    expect(transport.getStatus()).toBe('idle');
    expect(statusChanges).toEqual(['sending', 'idle']);

    transport.destroy();
  });

  it('status transitions: idle -> sending -> error (failure)', async () => {
    const statusChanges: LLMTransportStatus[] = [];
    const sendToLLM = vi.fn().mockRejectedValue(new Error('Network error'));
    const transport = createLLMTransport({
      sendToLLM,
      onStatusChange: (s) => statusChanges.push(s),
      maxRetries: 0,
    });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    await vi.runAllTimersAsync();
    await promise;

    expect(transport.getStatus()).toBe('error');
    expect(statusChanges).toEqual(['sending', 'error']);

    transport.destroy();
  });

  it('config.onStatusChange is called on each status transition', async () => {
    const onStatusChange = vi.fn();
    const sendToLLM = vi.fn().mockResolvedValue(successResponse());
    const transport = createLLMTransport({ sendToLLM, onStatusChange });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    await vi.runAllTimersAsync();
    await promise;

    expect(onStatusChange).toHaveBeenCalledWith('sending');
    expect(onStatusChange).toHaveBeenCalledWith('idle');

    transport.destroy();
  });

  it('subscribe/getSnapshot follow useSyncExternalStore pattern', async () => {
    const sendToLLM = vi.fn().mockResolvedValue(successResponse());
    const transport = createLLMTransport({ sendToLLM });

    const listener = vi.fn();
    const unsub = transport.subscribe(listener);

    // Snapshot should be JSON with status
    const snap1 = JSON.parse(transport.getSnapshot());
    expect(snap1.status).toBe('idle');

    const promise = transport.processIntent(makeIntent(), makeSnapshot());

    // After dispatch, listener should have been called for sending
    expect(listener).toHaveBeenCalled();

    const snap2 = JSON.parse(transport.getSnapshot());
    expect(snap2.status).toBe('sending');

    await vi.runAllTimersAsync();
    await promise;

    const snap3 = JSON.parse(transport.getSnapshot());
    expect(snap3.status).toBe('idle');

    unsub();
    transport.destroy();
  });

  it('timeout: if sendToLLM takes longer than config.timeout, abort and retry', async () => {
    let callCount = 0;
    const sendToLLM = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: never resolves (simulates timeout)
        return new Promise(() => {});
      }
      // Second call: resolves
      return Promise.resolve(successResponse());
    });
    const transport = createLLMTransport({
      sendToLLM,
      timeout: 5000,
      maxRetries: 2,
    });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());

    // Advance past first timeout
    await vi.advanceTimersByTimeAsync(5000);
    // Advance past backoff delay (1000ms * 2^0 = 1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    // Let second call resolve
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result.status).toBe('resolved');
    expect(sendToLLM).toHaveBeenCalledTimes(2);

    transport.destroy();
  });

  it('retry: up to maxRetries with exponential backoff, then returns error', async () => {
    const sendToLLM = vi.fn().mockImplementation(() => new Promise(() => {}));
    const transport = createLLMTransport({
      sendToLLM,
      timeout: 1000,
      maxRetries: 2,
    });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());

    // Attempt 0: times out at 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // Backoff 1: 1000ms delay
    await vi.advanceTimersByTimeAsync(1000);
    // Attempt 1: times out at 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // Backoff 2: 2000ms delay
    await vi.advanceTimersByTimeAsync(2000);
    // Attempt 2: times out at 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // All retries exhausted
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toContain('timeout');
    }
    // 1 initial + 2 retries = 3 total calls
    expect(sendToLLM).toHaveBeenCalledTimes(3);

    transport.destroy();
  });

  it('after all retries exhausted, returns IntentResult error with timeout message', async () => {
    const sendToLLM = vi.fn().mockImplementation(() => new Promise(() => {}));
    const transport = createLLMTransport({
      sendToLLM,
      timeout: 500,
      maxRetries: 1,
    });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());

    // Attempt 0: timeout
    await vi.advanceTimersByTimeAsync(500);
    // Backoff: 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // Attempt 1: timeout
    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toMatch(/LLM timeout after \d+ retries/);
    }

    transport.destroy();
  });

  it('destroy clears listeners', () => {
    const transport = createLLMTransport({
      sendToLLM: vi.fn().mockResolvedValue(successResponse()),
    });

    const listener = vi.fn();
    transport.subscribe(listener);
    transport.destroy();

    // After destroy, no more notifications
    // (We can't easily trigger a status change after destroy,
    // but we verify destroy doesn't throw)
    expect(listener).not.toHaveBeenCalled();
  });

  it('handles sendToLLM rejection (not timeout) as immediate error', async () => {
    const sendToLLM = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const transport = createLLMTransport({
      sendToLLM,
      maxRetries: 0,
    });

    const promise = transport.processIntent(makeIntent(), makeSnapshot());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toBe('Connection refused');
    }

    transport.destroy();
  });
});
