/**
 * The "Illustrative — static, not derived from live UE5 source" disclaimer must
 * warn exactly when the data IS static — i.e. when NOT connected to a live UE5
 * source (`isLive === false`), the same way TagAuditSection's sibling
 * "illustrative (static)" badge already does (`!isLive`). AttributesSection had
 * the condition inverted (`isLive &&`), so the warning showed only once a real
 * UE5 source was connected and stayed silent on the static default.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AttributesSection } from '@/components/modules/core-engine/sub_ability/tags/AttributesSection';
import { SpellbookDataCtx } from '@/components/modules/core-engine/sub_ability/_shared/context';
import type { SpellbookLiveData } from '@/components/modules/core-engine/sub_ability/_shared/types';
import { buildSpellbookView } from '@/components/modules/core-engine/sub_ability/_shared/spellbookView';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function makeLiveData(over: Partial<SpellbookLiveData>): SpellbookLiveData {
  return {
    ...buildSpellbookView({ live: null, appTags: [], entries: [] }),
    isLive: false, isSyncing: false, parsedAt: null, refresh: () => {},
    CORE_ATTRIBUTES: [], DERIVED_ATTRIBUTES: [], TAG_TREE: [], ABILITY_RADAR_DATA: [],
    TAG_DEP_NODES: [], TAG_DEP_EDGES: [], COOLDOWN_ABILITIES: [],
    TAG_AUDIT_CATEGORIES: [], TAG_USAGE_FREQUENCY: [], TAG_AUDIT: null,
    TAG_DETAIL_MAP: {},
    ...over,
  };
}

const sectionProps = {
  featureMap: new Map(),
  defs: [],
  expanded: null,
  onToggle: () => {},
};

describe('AttributesSection — static-data disclaimer', () => {
  it('shows the "illustrative" warning when NOT live (the static default)', () => {
    render(
      <SpellbookDataCtx.Provider value={makeLiveData({ isLive: false })}>
        <AttributesSection {...sectionProps} />
      </SpellbookDataCtx.Provider>,
    );
    expect(screen.getByText('Illustrative — static, not derived from live UE5 source.')).toBeTruthy();
    expect(screen.getByText('Illustrative — static projection, not derived from live UE5 source.')).toBeTruthy();
  });

  it('hides the warning once a live UE5 source is connected', () => {
    render(
      <SpellbookDataCtx.Provider value={makeLiveData({ isLive: true })}>
        <AttributesSection {...sectionProps} />
      </SpellbookDataCtx.Provider>,
    );
    expect(screen.queryByText('Illustrative — static, not derived from live UE5 source.')).toBeNull();
    expect(screen.queryByText('Illustrative — static projection, not derived from live UE5 source.')).toBeNull();
  });
});
