import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';

afterEach(cleanup);

const STATUSES = [
  { moduleId: 'arpg-character', featureName: 'AARPGCharacterBase', status: 'implemented' },
  { moduleId: 'arpg-character', featureName: 'AARPGPlayerCharacter', status: 'partial' },
];

function renderWithStatuses() {
  mockFetch({ body: { success: true, data: { statuses: STATUSES } } });
  return render(<FeatureConstellation />);
}

describe('FeatureConstellation', () => {
  it('renders the constellation SVG with feature nodes once statuses load', async () => {
    renderWithStatuses();
    await waitFor(() => expect(screen.getByRole('img', { name: /feature constellation/i })).toBeTruthy());
    // A foundational feature node is rendered as SVG text
    expect(screen.getByText('AARPGCharacterBase')).toBeTruthy();
  });

  it('renders a module picker defaulting to arpg-character', async () => {
    renderWithStatuses();
    const select = await screen.findByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('arpg-character');
  });

  it('shows the status legend and a "do this next" recommendation', async () => {
    renderWithStatuses();
    await screen.findByRole('img', { name: /feature constellation/i });
    expect(screen.getByText(/Blocked path/i)).toBeTruthy();
    // "Do this next" appears in both the legend and the callout
    expect(screen.getAllByText(/Do this next/i).length).toBeGreaterThanOrEqual(1);
  });

  it('re-renders the graph for a different module when the picker changes', async () => {
    renderWithStatuses();
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'arpg-loot' } });
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('arpg-loot'));
    // A feature unique to arpg-loot now renders
    expect(screen.getByText('UARPGLootTable')).toBeTruthy();
    // ...and a character-only feature is gone
    expect(screen.queryByText('AARPGCharacterBase')).toBeNull();
  });
});
