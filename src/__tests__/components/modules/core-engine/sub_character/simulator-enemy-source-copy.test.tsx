import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EnemySourcePanel } from '@/components/modules/core-engine/sub_character/simulator/predictive/EnemySourcePanel';
import { HARDCODED_ENEMY_SOURCE } from '@/lib/combat/simulation-engine';

afterEach(cleanup);

describe('EnemySourcePanel — the read-failure copy does not claim a run that has not happened', () => {
  it('says sweeps run on the fixtures, not that a sweep already ran', () => {
    // The top-of-panel instance renders this on mount, before any Run.
    const { container } = render(<EnemySourcePanel provenance={HARDCODED_ENEMY_SOURCE} error="HTTP 500" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Bestiary read failed: HTTP 500');
    expect(text).not.toContain('the sweep ran on');
    expect(text).toContain('sweeps run on the hardcoded fixtures');
  });
});
