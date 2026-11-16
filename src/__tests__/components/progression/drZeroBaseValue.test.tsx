import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DRCodeGenerator } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator';
import { DR_CONFIGS } from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

afterEach(cleanup);

/** Clearing the Base/pt field sends 0; the preview divides by the linear total. */
describe('DRCodeGenerator with a zero base value', () => {
  const configs = DR_CONFIGS.map((c, i) => (i === 0 ? { ...c, baseValuePerPoint: 0 } : c));

  it('renders no NaN in the card or the chart', () => {
    const { container } = render(<DRCodeGenerator configs={configs} onConfigsChange={() => {}} />);
    expect(container.textContent).not.toContain('NaN');
    const bad = [...container.querySelectorAll('polyline')]
      .filter((p) => (p.getAttribute('points') ?? '').includes('NaN'));
    expect(bad.length).toBe(0);
  });
});
