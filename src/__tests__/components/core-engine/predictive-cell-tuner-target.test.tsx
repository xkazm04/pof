import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DEFAULT_PREDICTIVE_CONFIG } from '@/lib/combat/predictive-balance';
import { CellTuner } from '@/components/modules/core-engine/sub_character/simulator/predictive/CellTuner';

afterEach(cleanup);

// The target-survival field reconciles at commit (blur / Solve), not per keystroke.
describe('CellTuner target survival field', () => {
  const field = () => screen.getByLabelText('Target survival %') as HTMLInputElement;
  const mount = () => render(
    <CellTuner config={DEFAULT_PREDICTIVE_CONFIG} cell={{ encounterIndex: 0, level: 7 }} label="3x Forest Grunt" onApply={() => {}} />,
  );

  it('keeps a cleared field empty until blur, then restores the last value', () => {
    mount();
    fireEvent.change(field(), { target: { value: '' } });
    expect(field().value).toBe('');
    fireEvent.blur(field());
    expect(field().value).toBe('80');
  });

  it('clamps an out-of-range draft at blur, not while typing', () => {
    mount();
    fireEvent.change(field(), { target: { value: '250' } });
    expect(field().value).toBe('250');
    fireEvent.blur(field());
    expect(field().value).toBe('100');
  });
});
