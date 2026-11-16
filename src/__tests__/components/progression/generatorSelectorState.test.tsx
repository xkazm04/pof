import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DRCodeGenerator } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator';
import { XpTableGenerator } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator';
import { EncounterTTKSimulator } from '@/components/modules/core-engine/sub_progression/_internals/EncounterTTKSimulator';
import { DR_CONFIGS } from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

afterEach(cleanup);

const pressed = (name: string | RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

/** These selectors show which option is on by colour alone. */
describe('selector buttons expose their state', () => {
  it('XpTableGenerator output tabs', () => {
    render(<XpTableGenerator baseXp={100} curveExp={1.5} />);
    expect(pressed('Preview Table')).toBe('true');
    expect(pressed('CSV Export')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'CSV Export' }));
    expect(pressed('CSV Export')).toBe('true');
  });

  it('DRCodeGenerator output tabs', () => {
    render(<DRCodeGenerator configs={DR_CONFIGS} onConfigsChange={() => {}} />);
    expect(pressed('GE_AttributeScaling.h')).toBe('true');
    expect(pressed('GE_AttributeScaling.cpp')).toBe('false');
  });

  it('EncounterTTKSimulator build and enemy pickers', () => {
    render(<EncounterTTKSimulator />);
    expect(pressed('Warrior')).toBe('true');
    expect(pressed('Mage')).toBe('false');
    expect(pressed(/Normal/)).toBe('true');
    expect(pressed(/Boss/)).toBe('false');
  });
});
