/**
 * The safety-fallback dispatch is documented as a "loud-failure backstop": a
 * terminal that never announced readiness may have no listener, so the prompt can
 * vanish. The fallback must say so in the log; the normal ready paths stay quiet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({
  logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import { UI_TIMEOUTS } from '@/lib/constants';

describe('dispatchPromptWhenReady — fallback is loud', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    warn.mockClear();
    window.__pofReadyTerminals = new Set<string>();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete window.__pofReadyTerminals;
  });

  it('warns, naming the tab, when the fallback timer dispatches', () => {
    dispatchPromptWhenReady('term-silent', 'p', 'checklist');
    vi.advanceTimersByTime(UI_TIMEOUTS.terminalReadyFallback);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('term-silent');
  });

  it('stays quiet when the terminal announces readiness in time', () => {
    dispatchPromptWhenReady('term-ok', 'p');
    window.dispatchEvent(new CustomEvent('pof-cli-terminal-ready', { detail: { instanceId: 'term-ok' } }));
    vi.advanceTimersByTime(UI_TIMEOUTS.terminalReadyFallback);
    expect(warn).not.toHaveBeenCalled();
  });
});
