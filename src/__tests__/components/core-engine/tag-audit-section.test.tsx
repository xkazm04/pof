import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TagAuditSection } from '@/components/modules/core-engine/sub_ability/tags/TagAuditSection';
import { SpellbookDataCtx } from '@/components/modules/core-engine/sub_ability/_shared/context';
import type { SpellbookLiveData } from '@/components/modules/core-engine/sub_ability/_shared/types';
import { computeTagAudit } from '@/lib/ability/tag-audit';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

/** Minimal live-data context value; only the audit fields matter for this section. */
function makeLiveData(over: Partial<SpellbookLiveData>): SpellbookLiveData {
  return {
    isLive: true, isSyncing: false, parsedAt: '2026-01-01T00:00:00Z', refresh: () => {},
    CORE_ATTRIBUTES: [], DERIVED_ATTRIBUTES: [], TAG_TREE: [], ABILITY_RADAR_DATA: [],
    TAG_DEP_NODES: [], TAG_DEP_EDGES: [], COOLDOWN_ABILITIES: [],
    TAG_AUDIT_CATEGORIES: [], TAG_USAGE_FREQUENCY: [], TAG_AUDIT: null,
    TAG_DETAIL_MAP: {},
    ...over,
  };
}

describe('TagAuditSection — derived audit', () => {
  it('renders the derived score and breakdown counts when live', () => {
    // declared {A.b, A.c}, referenced {A.b, A.x} -> matched 1, undeclared 1, orphaned 1, score 33
    const audit = computeTagAudit(['A.b', 'A.c'], ['A.b', 'A.x']);
    const value = makeLiveData({ isLive: true, TAG_AUDIT: audit });

    render(
      <SpellbookDataCtx.Provider value={value}>
        <TagAuditSection />
      </SpellbookDataCtx.Provider>,
    );

    expect(screen.getByText('Tag Hygiene Score')).toBeTruthy();
    // Derived score (33) surfaces in the ScoreRing center + aria-label.
    expect(screen.getByLabelText('Score: 33 out of 100')).toBeTruthy();
    // Breakdown cards.
    expect(screen.getByText('Matched')).toBeTruthy();
    expect(screen.getByText('Undeclared')).toBeTruthy();
    expect(screen.getByText('Orphaned')).toBeTruthy();
    // The named undeclared tag is listed (details children render in the DOM).
    expect(screen.getByText('A.x')).toBeTruthy();
    // Never the old fake constant.
    expect(screen.queryByText('85/100 - Good health, minor issues detected')).toBeNull();
  });
});

describe('TagAuditSection — not synced', () => {
  it('shows the explicit not-synced state (never the fake 85) when no live parse', () => {
    // No provider -> useSpellbookData returns the fallback (isLive false, TAG_AUDIT null).
    render(<TagAuditSection />);

    expect(screen.getByText('NOT SYNCED')).toBeTruthy();
    expect(screen.getByText(/Connect the UE5 source/i)).toBeTruthy();
    // No score ring / hardcoded 85.
    expect(screen.queryByText('Tag Hygiene Score')).toBeNull();
    expect(screen.queryByText(/85\/100/)).toBeNull();
  });
});
