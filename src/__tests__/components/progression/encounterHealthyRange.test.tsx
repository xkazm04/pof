import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { EncounterTTKSimulator } from '@/components/modules/core-engine/sub_progression/_internals/EncounterTTKSimulator';
import { normalizeHealthyRange } from '@/components/modules/core-engine/sub_progression/_internals/EncounterTTKSimulator/helpers';

afterEach(cleanup);

describe('normalizeHealthyRange', () => {
  it('floors min at 1 and never lets max fall below min', () => {
    expect(normalizeHealthyRange(2, 5)).toEqual({ min: 2, max: 5 });
    expect(normalizeHealthyRange(0, 0)).toEqual({ min: 1, max: 1 });
    expect(normalizeHealthyRange(12, 5)).toEqual({ min: 12, max: 12 });
  });
});

describe('EncounterTTKSimulator with an inverted healthy range', () => {
  it('does not call an encounter below the minimum too easy', () => {
    render(<EncounterTTKSimulator />);
    fireEvent.change(screen.getByTitle('Min healthy ratio'), { target: { value: '12' } });
    expect(screen.getAllByText('HARD', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/encounter too easy/)).toBeNull();
    expect(screen.getByText(/below minimum 12:1/)).toBeTruthy();
  });
});
