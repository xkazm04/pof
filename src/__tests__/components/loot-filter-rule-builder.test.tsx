import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { LootFilterRuleBuilder } from '@/components/modules/core-engine/sub_inventory/loot-filter/LootFilterRuleBuilder';
import { useLootFilterStore } from '@/stores/lootFilterStore';
import { mockFetch } from '@/__tests__/setup';

// Avoid jsdom "navigation not implemented" noise from the blob-download side effect.
vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }));

afterEach(cleanup);

beforeEach(() => {
  useLootFilterStore.setState({
    rulesetsById: {
      rs: {
        id: 'rs', name: 'Test Filter', updatedAt: '2026-01-01T00:00:00.000Z',
        rules: [
          { id: 'a', name: 'Highlight Legendaries', enabled: true, action: 'highlight', condition: { rarities: ['Legendary'] }, style: { beam: true } },
          { id: 'b', name: 'Hide Commons', enabled: true, action: 'hide', condition: { rarities: ['Common'] }, style: {} },
        ],
      },
    },
    order: ['rs'],
    activeRulesetId: 'rs',
  });
  mockFetch({ body: { success: true, data: [] } });
});

describe('LootFilterRuleBuilder', () => {
  it('renders the active ruleset name and its rules', () => {
    const { getByDisplayValue, getAllByText } = render(<LootFilterRuleBuilder />);
    expect(getByDisplayValue('Test Filter')).toBeTruthy();
    // Rule names show in the rule list (and may recur as matched-rule labels in the preview).
    expect(getAllByText('Highlight Legendaries').length).toBeGreaterThan(0);
    expect(getAllByText('Hide Commons').length).toBeGreaterThan(0);
  });

  it('shows a live preview summary with surfaced / highlighted / hidden tallies', () => {
    const { getByTestId } = render(<LootFilterRuleBuilder />);
    // Legendary items are highlighted, Commons hidden, the rest surfaced.
    expect(Number(getByTestId('lf-count-highlighted').textContent)).toBeGreaterThan(0);
    expect(Number(getByTestId('lf-count-hidden').textContent)).toBeGreaterThan(0);
    expect(Number(getByTestId('lf-count-surfaced').textContent)).toBeGreaterThan(0);
  });

  it('adds a rule when "Add rule" is clicked', () => {
    const { getByText } = render(<LootFilterRuleBuilder />);
    expect(useLootFilterStore.getState().rulesetsById.rs.rules).toHaveLength(2);
    fireEvent.click(getByText(/add rule/i));
    expect(useLootFilterStore.getState().rulesetsById.rs.rules).toHaveLength(3);
  });

  it('exports the ruleset to the pipeline (POSTs an artifact) when Generate is clicked', () => {
    const fetchMock = mockFetch({ body: { success: true, data: [] } });
    const { getByText } = render(<LootFilterRuleBuilder />);
    fireEvent.click(getByText(/generate datatable/i));
    const posted = fetchMock.mock.calls.some(
      ([url, init]) => String(url).includes('/api/pipeline-artifacts') && (init as RequestInit)?.method === 'POST',
    );
    expect(posted).toBe(true);
  });

  it('toggles a rule on/off via its enable control', () => {
    const { getAllByTestId } = render(<LootFilterRuleBuilder />);
    const toggles = getAllByTestId('lf-rule-toggle');
    fireEvent.click(toggles[0]);
    expect(useLootFilterStore.getState().rulesetsById.rs.rules[0].enabled).toBe(false);
  });
});
