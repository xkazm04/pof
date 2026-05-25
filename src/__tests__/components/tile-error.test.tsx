import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { classifyTileError, TileError } from '@/components/modules/visual-gen/material-lab/TileError';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('classifyTileError', () => {
  it.each([
    ['SCENARIO_API_KEY not configured', 'not-configured', /SCENARIO_API_KEY/],
    ['LEONARDO_API_KEY not configured', 'not-configured', /LEONARDO_API_KEY/],
    ['LEONARDO_API_KEY not set in environment', 'not-configured', /LEONARDO_API_KEY/],
    ['Leonardo generation failed (429): rate limit exceeded', 'rate-limit', /throttling|wait/i],
    ['Leonardo generation failed (401): Unauthorized', 'auth', /key.*rejected|rejected/i],
    ['Leonardo generation failed (403): Forbidden', 'auth', /rejected/i],
    ['fetch failed: ENOTFOUND api.leonardo.ai', 'network', /provider|connection/i],
    ['Leonardo generation timed out after 60s', 'network', /provider|connection/i],
    ['Leonardo generation failed (500): boom', 'generic', undefined],
  ] as const)('classifies %j as %s', (err, kind, hintPattern) => {
    const r = classifyTileError(err);
    expect(r.kind).toBe(kind);
    if (hintPattern) expect(r.hint).toMatch(hintPattern);
  });
});

describe('TileError component', () => {
  it('renders headline + hint + raw error for a not-configured error and hides Retry', () => {
    render(<TileError testId="t" error="SCENARIO_API_KEY not configured" onRetry={() => {}} />);
    const node = screen.getByTestId('t');
    expect(node.getAttribute('data-error-kind')).toBe('not-configured');
    expect(node.textContent).toMatch(/Provider not configured/);
    expect(node.textContent).toMatch(/SCENARIO_API_KEY/);
    expect(screen.queryByTestId('t-retry')).toBeNull();
  });

  it('shows a Retry button for recoverable errors and invokes the callback', () => {
    const onRetry = vi.fn();
    render(<TileError testId="t" error="Leonardo generation failed (429): rate limit" onRetry={onRetry} />);
    const btn = screen.getByTestId('t-retry');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits Retry when no onRetry handler is provided', () => {
    render(<TileError testId="t" error="Leonardo generation failed (500): boom" />);
    expect(screen.queryByTestId('t-retry')).toBeNull();
  });
});
