import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PipelineRail } from '@/components/layout-lab/PipelineRail';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
afterEach(cleanup);

const steps = ['Concept Brief', 'Attributes', 'Economy'];
const baseProps = {
  steps, stepIdx: 0,
  displayStatus: () => 'pending' as const,
  isLive: () => true,
  tooltipFor: () => '', ariaFor: (s: string) => `${s}: pending`,
};

it('renders a dot per step with the stamp testid', () => {
  render(<PipelineRail {...baseProps} onSelectStep={() => {}} />);
  expect(screen.getByTestId('step-dot-stamp-0')).toBeTruthy();
  expect(screen.getByTestId('step-dot-stamp-2')).toBeTruthy();
});
it('Enter selects the active step (roving)', () => {
  const onSelectStep = vi.fn();
  render(<PipelineRail {...baseProps} onSelectStep={onSelectStep} />);
  const list = screen.getByRole('list', { name: /pipeline/i });
  fireEvent.keyDown(list, { key: 'ArrowDown' });
  fireEvent.keyDown(list, { key: 'Enter' });
  expect(onSelectStep).toHaveBeenCalledWith(1);
});
