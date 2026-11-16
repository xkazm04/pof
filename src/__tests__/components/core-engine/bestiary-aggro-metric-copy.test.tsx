/**
 * AggroMetric's per-target tooltips read "Player: 85%", "Companion: 45%", "Decoy: 20%" -
 * shares that sum to 150%. Threat is a raw score (AggroTable prints it bare), so the
 * tooltip must not dress it as a percentage.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AggroMetric } from '@/components/modules/core-engine/sub_bestiary/metrics/AggroMetric';
import { AGGRO_TABLE } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

describe('AggroMetric tooltip copy', () => {
  it('names threat as a score, never a percentage', () => {
    const { container } = render(<AggroMetric />);
    const titles = Array.from(container.querySelectorAll('[title]')).map(el => el.getAttribute('title'));
    expect(titles).toHaveLength(AGGRO_TABLE.length);
    for (const t of titles) expect(t).not.toContain('%');
    expect(titles).toEqual(AGGRO_TABLE.map(e => `${e.target}: ${e.threat} threat`));
  });
});
