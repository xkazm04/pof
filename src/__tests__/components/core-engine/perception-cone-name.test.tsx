/**
 * The perception diagram is the only place the tab shows WHO the enemy detects; as an
 * unnamed <svg> it said nothing to a screen reader. It must be an image with a name
 * that carries the sense reach and each entity's detection state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PerceptionConeViz } from '@/components/modules/core-engine/sub_bestiary/ai-logic/PerceptionConeViz';
import type { DetectedEntity } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { DEFAULT_SENSE } from '@/lib/bestiary/sense-profile';
import { ACCENT_RED, STATUS_SUCCESS, STATUS_NEUTRAL } from '@/lib/chart-colors';

afterEach(cleanup);

const ENTITIES: DetectedEntity[] = [
  { label: 'Player', x: 44.7, y: 24.4, color: ACCENT_RED, inCone: true, inHearing: true },
  { label: 'NPC', x: 93.4, y: 81.3, color: STATUS_SUCCESS, inCone: false, inHearing: true },
  { label: 'Crate', x: 10, y: 10, color: STATUS_NEUTRAL, inCone: false, inHearing: false },
];

describe('PerceptionConeViz accessible name', () => {
  it('is a named image carrying reach and detection states', () => {
    const { container } = render(<PerceptionConeViz entities={ENTITIES} profile={DEFAULT_SENSE} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    const name = svg.getAttribute('aria-label') ?? '';
    expect(name).toContain(`${DEFAULT_SENSE.radiusCm}cm`);
    expect(name).toContain('Player in sight');
    expect(name).toContain('NPC heard');
    expect(name).toContain('Crate undetected');
  });
});
