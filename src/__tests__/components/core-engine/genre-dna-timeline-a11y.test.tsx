/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, accessibility-checker):
 * GenreDnaTimeline's per-pattern first/latest/delta figures appeared only on
 * mouseenter of an SVG group; the chart was one role="img" with a generic
 * label. Instrument: read the accessible text with NO hover.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GameplayPattern, TelemetrySnapshot } from '@/types/telemetry';
import { GenreDnaTimeline } from '@/components/modules/core-engine/GenreDnaTimeline';

afterEach(cleanup);

function snap(id: string, at: string, conf: Partial<Record<GameplayPattern, number>>): TelemetrySnapshot {
  return {
    id, scannedAt: at, projectPath: 'p',
    detectedPatterns: Object.entries(conf).map(([pattern, confidence]) => ({
      pattern: pattern as GameplayPattern, confidence: confidence as number, evidence: [], detectedAt: at,
    })),
  } as unknown as TelemetrySnapshot;
}

describe('GenreDnaTimeline figures without a pointer', () => {
  it('exposes every pattern first / latest / delta in a table outside the img', () => {
    const history = [
      snap('b', '2026-06-02T00:00:00Z', { 'loot-driven': 70, 'gas-combo-chains': 20 }),
      snap('a', '2026-06-01T00:00:00Z', { 'loot-driven': 50, 'gas-combo-chains': 45 }),
    ];
    const { container } = render(<GenreDnaTimeline history={history} />);
    const rows = Array.from(container.querySelectorAll('table tbody tr'));
    expect(rows).toHaveLength(2);
    const byName = (n: string) => rows.find((r) => r.textContent?.includes(n))!;
    const loot = byName('Loot Driven').textContent!;
    expect(loot).toContain('50%');
    expect(loot).toContain('70%');
    expect(loot).toContain('+20');
    const combo = byName('Gas Combo Chains').textContent!;
    expect(combo).toContain('45%');
    expect(combo).toContain('20%');
    expect(combo).toContain('-25');
    // the table is not hidden from assistive tech by the role="img" svg
    const svg = container.querySelector('svg[role="img"]')!;
    expect(svg.contains(container.querySelector('table'))).toBe(false);
  });
});
