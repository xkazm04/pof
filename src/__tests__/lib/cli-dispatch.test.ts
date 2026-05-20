import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import { UI_TIMEOUTS } from '@/lib/constants';

/** Collect pof-cli-prompt prompts addressed to a given tabId. */
function collectPrompts(tabId: string): string[] {
  const received: string[] = [];
  window.addEventListener('pof-cli-prompt', (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.tabId === tabId) received.push(detail.prompt);
  });
  return received;
}

describe('dispatchPromptWhenReady', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.__pofReadyTerminals = new Set<string>();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete window.__pofReadyTerminals;
  });

  it('dispatches immediately when the terminal is already ready', () => {
    const received = collectPrompts('term-1');
    window.__pofReadyTerminals!.add('term-1');

    dispatchPromptWhenReady('term-1', 'hello');

    expect(received).toEqual(['hello']);
  });

  it('waits for the terminal-ready signal when the terminal mounts late', () => {
    const received = collectPrompts('term-2');

    dispatchPromptWhenReady('term-2', 'late');
    expect(received).toEqual([]); // not ready yet — nothing dispatched

    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-2' } }),
    );
    expect(received).toEqual(['late']);
  });

  it('dispatches via the safety fallback and never twice', () => {
    const received = collectPrompts('term-3');

    dispatchPromptWhenReady('term-3', 'fallback');
    expect(received).toEqual([]);

    vi.advanceTimersByTime(UI_TIMEOUTS.terminalReadyFallback);
    expect(received).toEqual(['fallback']); // fallback fired

    // A late ready signal must NOT cause a second dispatch.
    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-3' } }),
    );
    expect(received).toEqual(['fallback']);
  });

  it('ignores ready signals for other terminals', () => {
    const received = collectPrompts('term-4');

    dispatchPromptWhenReady('term-4', 'mine');
    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'other' } }),
    );
    expect(received).toEqual([]); // wrong terminal — ignored

    window.dispatchEvent(
      new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-4' } }),
    );
    expect(received).toEqual(['mine']);
  });
});
