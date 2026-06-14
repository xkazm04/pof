import { describe, it, expect } from 'vitest';
import { buildDeploymentSection, type BuildRow } from '@/lib/gdd-synthesizer';

const NOW = '2026-06-14T00:00:00.000Z';

function makeBuild(overrides: Partial<BuildRow>): BuildRow {
  return {
    platform: 'win',
    config: 'release',
    status: 'success',
    size_bytes: null,
    duration_ms: null,
    created_at: NOW,
    ...overrides,
  };
}

describe('buildDeploymentSection — Avg Duration', () => {
  it('reports the true arithmetic mean of build durations, not a pairwise running mean', () => {
    // Durations [10, 20, 30, 40] ms → arithmetic mean = 25ms.
    // The old pairwise running mean (((10+20)/2+30)/2+40)/2 = 31.25ms would be wrong.
    const builds: BuildRow[] = [10, 20, 30, 40].map((d) =>
      makeBuild({ platform: 'win', duration_ms: d }),
    );

    const section = buildDeploymentSection(builds, NOW);

    // formatDuration(25) === '25ms'; formatDuration(31.25) === '31.25ms'
    expect(section.content).toContain('25ms');
    expect(section.content).not.toContain('31.25ms');
  });

  it('keeps per-platform durations independent and ignores null durations', () => {
    const builds: BuildRow[] = [
      makeBuild({ platform: 'win', duration_ms: 100 }),
      makeBuild({ platform: 'win', duration_ms: 300 }), // win mean = 200ms
      makeBuild({ platform: 'win', duration_ms: null }), // excluded from mean
      makeBuild({ platform: 'mac', duration_ms: 1000 }),
      makeBuild({ platform: 'mac', duration_ms: 3000 }), // mac mean = 2000ms = 2.0s
    ];

    const section = buildDeploymentSection(builds, NOW);

    // win: mean 200ms; mac: mean 2000ms → formatDuration => '2.0s'
    expect(section.content).toContain('| win | 3 | 100% | — | 200ms |');
    expect(section.content).toContain('| mac | 2 | 100% | — | 2.0s |');
  });
});
