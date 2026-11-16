/**
 * Compare may not relabel a cancelled build as failed.
 *
 * BuildRow learned the third arm of 'success' | 'failed' | 'cancelled' (glyph + word);
 * BuildComparison still collapsed every non-success into "(failed)" in its pickers.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { BuildRecord } from '@/lib/packaging/build-history-store';
import { BuildComparison } from '@/components/modules/game-systems/BuildComparison';

afterEach(cleanup);

function rec(over: Partial<BuildRecord>): BuildRecord {
  return {
    id: 1, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 100, durationMs: 1000,
    version: null, outputPath: null, errorSummary: null, cookTimeMs: null, warningCount: 0, errorCount: 0,
    notes: null, createdAt: '2026-11-01T00:00:00.000Z',
    ...over,
  } as BuildRecord;
}

describe('BuildComparison names a cancelled build as cancelled', () => {
  it('labels the picker option "(cancelled)", never "(failed)"', () => {
    const { container } = render(
      <BuildComparison builds={[rec({ id: 2, status: 'cancelled', createdAt: '2026-11-02T00:00:00.000Z' }), rec({ id: 1 })]} />,
    );
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.textContent ?? '');
    const cancelledOpts = options.filter((t) => t.startsWith('#2'));
    expect(cancelledOpts.length).toBe(2);
    for (const t of cancelledOpts) {
      expect(t).toContain('(cancelled)');
      expect(t).not.toContain('(failed)');
    }
  });

  it('still labels a failed build "(failed)"', () => {
    const { container } = render(
      <BuildComparison builds={[rec({ id: 2, status: 'failed', createdAt: '2026-11-02T00:00:00.000Z' }), rec({ id: 1 })]} />,
    );
    const opt = Array.from(container.querySelectorAll('option')).find((o) => (o.textContent ?? '').startsWith('#2'));
    expect(opt?.textContent).toContain('(failed)');
  });

  it('does not paint a cancelled status in the failure colour', () => {
    const { container } = render(
      <BuildComparison builds={[rec({ id: 2, status: 'cancelled', createdAt: '2026-11-02T00:00:00.000Z' }), rec({ id: 1 })]} />,
    );
    const cell = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'cancelled');
    expect(cell).toBeTruthy();
    // STATUS_ERROR #f87171 as jsdom reports inline colours.
    expect((cell as HTMLElement).style.color).not.toBe('rgb(248, 113, 113)');
  });

  it('does not count a cancelled build as the "last fail" quick pick', () => {
    const { container } = render(
      <BuildComparison builds={[rec({ id: 3, status: 'cancelled', createdAt: '2026-11-03T00:00:00.000Z' }), rec({ id: 2 }), rec({ id: 1 })]} />,
    );
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Last success vs last fail');
    expect(btn?.hasAttribute('disabled')).toBe(true);
  });
});
