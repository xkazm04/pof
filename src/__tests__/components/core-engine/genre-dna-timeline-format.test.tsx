/**
 * scan-sweep night 2026-11-08 (core-engine-scan-telemetry): GenreDnaTimeline kept its own
 * formatPatternName whose `w[0].toUpperCase()` threw on an empty segment ('a--b').
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GameplayPattern, TelemetrySnapshot } from '@/types/telemetry';
import { GenreDnaTimeline } from '@/components/modules/core-engine/GenreDnaTimeline';
import { formatPatternName } from '@/components/modules/core-engine/TelemetryEvolution/helpers';

afterEach(cleanup);

function snap(id: string, at: string, pattern: string, confidence: number): TelemetrySnapshot {
  return {
    id, scannedAt: at, projectPath: 'p',
    detectedPatterns: [{ pattern: pattern as GameplayPattern, confidence, evidence: [], detectedAt: at }],
  } as unknown as TelemetrySnapshot;
}

describe('GenreDnaTimeline pattern names', () => {
  it('renders a double-dash pattern id without throwing, using the shared formatter', () => {
    const history = [snap('b', '2026-06-02T00:00:00Z', 'a--b', 40), snap('a', '2026-06-01T00:00:00Z', 'a--b', 30)];
    const { container } = render(<GenreDnaTimeline history={history} />);
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(texts).toContain(formatPatternName('a--b'));
    expect(formatPatternName('a--b')).toBe('A  B');
  });
});
