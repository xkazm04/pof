import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ProduceLogPanel } from '@/components/layout-lab/ProduceLogPanel';
import { LIGHT } from '@/components/layout-lab/theme';
import { PRODUCE_DIRECTION_KEY } from '@/lib/catalog/produceDirection';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

afterEach(cleanup);

const art = (over: Partial<LabStepArtifact> = {}): LabStepArtifact => ({
  done: true, data: {}, ueAssets: [], at: '2026-07-20T10:00:00.000Z', ...over,
});

const steps = ['Concept', 'Art', 'Attributes'];

const renderPanel = (byStep: Record<string, LabStepArtifact> | undefined, onJump = vi.fn()) => {
  render(<ProduceLogPanel t={LIGHT} steps={steps} byStep={byStep} onJump={onJump} />);
  return onJump;
};

describe('<ProduceLogPanel />', () => {
  it('renders nothing at all when the pipeline has never run', () => {
    renderPanel({});
    expect(screen.queryByTestId('produce-log')).toBeNull();
  });

  it('renders nothing when the entity has no store row yet', () => {
    renderPanel(undefined);
    expect(screen.queryByTestId('produce-log')).toBeNull();
  });

  it('is collapsed by default — the entries are not in the DOM', () => {
    renderPanel({ Art: art() });
    expect(screen.getByTestId('produce-log')).toBeTruthy();
    expect(screen.queryByTestId('produce-log-entries')).toBeNull();
  });

  it('shows a needs-attention count WITHOUT being opened', () => {
    renderPanel({ Art: art({ error: 'boom' }), Concept: art({ syncError: 'no server' }) });
    expect(screen.getByTestId('produce-log-attention').textContent).toContain('2');
    // still collapsed — the count is the whole point
    expect(screen.queryByTestId('produce-log-entries')).toBeNull();
  });

  it('shows no attention badge on a clean pipeline', () => {
    renderPanel({ Art: art(), Concept: art() });
    expect(screen.queryByTestId('produce-log-attention')).toBeNull();
  });

  it('lists entries newest-first once expanded', () => {
    renderPanel({
      Concept: art({ at: '2026-07-20T09:00:00.000Z' }),
      Art: art({ at: '2026-07-20T11:00:00.000Z' }),
    });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    const rows = screen.getAllByTestId('produce-log-entry');
    expect(rows.map((r) => r.getAttribute('data-step'))).toEqual(['Art', 'Concept']);
  });

  it('shows a failure reason verbatim and says the earlier content survived', () => {
    renderPanel({ Art: art({ done: true, error: 'CLI exited 1: bad JSON' }) });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    const row = screen.getByTestId('produce-log-entry');
    expect(row.getAttribute('data-outcome')).toBe('failed');
    expect(within(row).getByTestId('produce-log-reason').textContent).toContain('CLI exited 1: bad JSON');
    expect(within(row).getByTestId('produce-log-reason').textContent).toMatch(/still here/i);
  });

  it('distinguishes a write-through failure from a produce failure', () => {
    renderPanel({ Art: art({ syncError: 'server rejected the payload' }) });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    const row = screen.getByTestId('produce-log-entry');
    expect(row.getAttribute('data-outcome')).toBe('unsynced');
    expect(within(row).getByTestId('produce-log-reason').textContent).toContain('server rejected the payload');
  });

  it('quotes the direction the operator typed', () => {
    renderPanel({
      Art: art({ data: { [PRODUCE_DIRECTION_KEY]: { direction: 'grimdark, muted', prompt: 'P' } } }),
    });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    expect(screen.getByTestId('produce-log-direction').textContent).toContain('grimdark, muted');
  });

  it('says so plainly when no direction was recorded, rather than showing an empty quote', () => {
    renderPanel({ Art: art() });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    expect(screen.getByTestId('produce-log-direction').textContent).toMatch(/no direction recorded/i);
  });

  it('jumps to the step by pipeline index', () => {
    const onJump = renderPanel({ Attributes: art() });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    fireEvent.click(screen.getByTestId('produce-log-jump'));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it('shows an orphaned artifact but offers no dead jump link', () => {
    renderPanel({ 'Retired Step': art() });
    fireEvent.click(screen.getByTestId('produce-log-toggle'));
    expect(screen.getByTestId('produce-log-orphan').textContent).toMatch(/no longer in this pipeline/i);
    expect(screen.queryByTestId('produce-log-jump')).toBeNull();
  });
});
