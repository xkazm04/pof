/**
 * The checklist context menu holds only an itemId. If `items` changes while the menu is
 * open (module switch, checklist reload) the lookup misses; the menu used to be handed
 * `undefined` through a non-null assertion. It must close instead.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { __resetModulePatternCache } from '@/components/modules/shared/RoadmapChecklist/useModulePatterns';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { getModuleChecklist } from '@/lib/module-registry';
import { mockFetchRoutes } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

afterEach(cleanup);

const MODULE = 'arpg-character';
const ITEMS = getModuleChecklist(MODULE);
const TARGET = ITEMS[1];

beforeEach(() => {
  __resetModulePatternCache();
  invalidateFeatureStatuses();
  usePatternLibraryStore.setState({ patterns: [], suggestions: [] });
  useModuleStore.setState({ checklistProgress: {}, checklistVerification: {}, moduleHistory: {} });
  useProjectStore.setState({ projectPath: 'C:/Proj' });
  mockFetchRoutes([
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
    { match: '/api/', response: { body: { success: true, data: {} } } },
  ]);
});

describe('RoadmapChecklist — context menu on an item that vanishes', () => {
  it('closes the menu when its item leaves `items`, and does not reopen when it returns', () => {
    const props = { subModuleId: MODULE, onRunPrompt: () => {}, accentColor: ACCENT_EMERALD, isRunning: false };
    const { rerender } = render(<RoadmapChecklist items={ITEMS} {...props} />);

    fireEvent.contextMenu(screen.getByTestId(`pof-module-${MODULE}-checklist-item-${TARGET.id}`));
    expect(screen.queryByText('Copy Prompt')).not.toBeNull();

    expect(() => {
      rerender(<RoadmapChecklist items={ITEMS.filter((i) => i.id !== TARGET.id)} {...props} />);
    }).not.toThrow();
    expect(screen.queryByText('Copy Prompt')).toBeNull();

    rerender(<RoadmapChecklist items={ITEMS} {...props} />);
    expect(screen.queryByText('Copy Prompt')).toBeNull();
  });
});
