import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PromptVersionTimeline } from '@/components/modules/evaluator/PromptVersionTimeline';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type {
  PromptVariant, VariantVersionEntry, VariantVersionHistory, VariantStats,
} from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;

function variant(over: Partial<PromptVariant>): PromptVariant {
  return {
    id: 'v', moduleId: MOD, checklistItemId: 'ac-1', label: 'v', prompt: '',
    origin: 'default', style: 'descriptive', parentId: null, active: false,
    createdAt: '2026-06-01T10:00:00.000Z', ...over,
  };
}

function stats(over: Partial<VariantStats>): VariantStats {
  return { variantId: 'v', trials: 0, successes: 0, successRate: 0, wins: 0, testCount: 0, ...over };
}

function entry(v: PromptVariant, s: VariantStats, isActive: boolean): VariantVersionEntry {
  return { variant: v, stats: s, isActive };
}

const root = variant({
  id: 'v-root', label: 'default variant (descriptive)', active: true,
  prompt: 'Implement a melee attack.\nVerify it compiles.',
  createdAt: '2026-06-01T10:00:00.000Z',
});
const child = variant({
  id: 'v-child', label: 'mutation variant (imperative)', origin: 'mutation',
  style: 'imperative', parentId: 'v-root', mutationType: 'imperative-rewrite', active: false,
  prompt: 'You MUST implement a melee attack.\nVerify it compiles.',
  createdAt: '2026-06-01T11:00:00.000Z',
});

const rootStats = stats({ variantId: 'v-root', trials: 4, successes: 3, successRate: 0.75, wins: 1, testCount: 1 });
const childStats = stats({ variantId: 'v-child', trials: 4, successes: 1, successRate: 0.25, wins: 0, testCount: 1 });

function history(): VariantVersionHistory {
  return {
    moduleId: MOD,
    checklistItemId: 'ac-1',
    versions: [entry(root, rootStats, true), entry(child, childStats, false)],
    roots: [
      {
        ...entry(root, rootStats, true),
        depth: 0,
        children: [{ ...entry(child, childStats, false), depth: 1, children: [] }],
      },
    ],
    activeVariantId: 'v-root',
  };
}

function setupStore() {
  const loadVersionHistory = vi.fn().mockResolvedValue(undefined);
  const restoreVariant = vi.fn().mockResolvedValue(child);
  usePromptEvolutionStore.setState({
    versionHistory: history(),
    isLoadingHistory: false,
    isRestoring: false,
    loadVersionHistory,
    restoreVariant,
  });
  return { loadVersionHistory, restoreVariant };
}

const ITEM_OPTIONS = [{ id: 'ac-1', label: 'ac-1 — Melee attack' }];

beforeEach(() => { setupStore(); });
afterEach(cleanup);

function selectItem() {
  fireEvent.change(screen.getByLabelText('Checklist item'), { target: { value: 'ac-1' } });
}

describe('PromptVersionTimeline', () => {
  it('loads history when a checklist item is picked', () => {
    const { loadVersionHistory } = setupStore();
    render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={ITEM_OPTIONS} />);
    selectItem();
    expect(loadVersionHistory).toHaveBeenCalledWith(MOD, 'ac-1');
  });

  it('renders the lineage tree with both versions and the current marker', () => {
    render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={ITEM_OPTIONS} />);
    selectItem();
    const rootNode = screen.getByTestId('version-node-v-root');
    expect(rootNode).toBeTruthy();
    expect(rootNode.getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('version-node-v-child')).toBeTruthy();
    // Only the active version carries the "current" badge.
    expect(screen.getAllByTestId('current-badge')).toHaveLength(1);
  });

  it('annotates each version with its A/B success rate', () => {
    render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={ITEM_OPTIONS} />);
    selectItem();
    expect(screen.getByText('75% · 3/4')).toBeTruthy();
    expect(screen.getByText('25% · 1/4')).toBeTruthy();
  });

  it('restores a version on click and disables restore for the current one', () => {
    const { restoreVariant } = setupStore();
    render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={ITEM_OPTIONS} />);
    selectItem();

    // The active version cannot be restored onto itself.
    expect((screen.getByTestId('restore-v-root') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('restore-v-child'));
    expect(restoreVariant).toHaveBeenCalledWith('v-child');
  });

  it('shows a side-by-side diff after two versions are picked to compare', async () => {
    render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={ITEM_OPTIONS} />);
    selectItem();
    expect(screen.queryByTestId('version-compare')).toBeNull();

    fireEvent.click(screen.getByTestId('compare-v-root'));
    fireEvent.click(screen.getByTestId('compare-v-child'));

    await waitFor(() => expect(screen.getByTestId('version-compare')).toBeTruthy());
  });
});
