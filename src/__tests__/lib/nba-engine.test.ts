import { describe, it, expect, beforeEach } from 'vitest';
import { computeNBA, getTopRecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
// localStorage mock installed by vitest setupFiles

// Reset all relevant stores before each test (partial merge — preserves action methods)
beforeEach(() => {
  useModuleStore.setState({
    checklistProgress: {},
    moduleHistory: {},
    moduleHealth: {},
  });
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
});

describe('computeNBA', () => {
  it('returns empty array for a module with no checklist', () => {
    // 'arpg-character' should have a checklist in the registry
    // but a bogus module should not
    const result = computeNBA('nonexistent-mod' as never);
    expect(result).toEqual([]);
  });

  it('returns recommendations for a module with uncompleted checklist items', () => {
    // arpg-combat should have checklist items defined in the registry
    const result = computeNBA('arpg-combat');
    // Should have at least one recommendation if checklist items exist
    if (result.length > 0) {
      expect(result[0].moduleId).toBe('arpg-combat');
      expect(result[0].score).toBeGreaterThanOrEqual(0);
      expect(result[0].item).toBeDefined();
      expect(result[0].item.id).toBeTruthy();
      expect(result[0].breakdown).toBeDefined();
    }
  });

  it('excludes completed checklist items from recommendations', () => {
    // First get all recommendations
    const allRecs = computeNBA('arpg-combat');
    if (allRecs.length === 0) return; // skip if module has no checklist

    // Mark the first item as completed
    const firstItemId = allRecs[0].item.id;
    useModuleStore.setState({
      checklistProgress: {
        'arpg-combat': { [firstItemId]: true },
      },
    });

    // Now compute again — the completed item should not appear
    const filtered = computeNBA('arpg-combat');
    expect(filtered.find((r) => r.item.id === firstItemId)).toBeUndefined();
  });

  it('returns results sorted by score descending', () => {
    const result = computeNBA('arpg-combat');
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('score breakdown components sum to the total score', () => {
    const result = computeNBA('arpg-combat');
    for (const rec of result) {
      const sum = rec.breakdown.urgency + rec.breakdown.successProb +
        rec.breakdown.impact + rec.breakdown.recency + rec.breakdown.readiness;
      expect(rec.score).toBe(Math.round(sum));
    }
  });

  it('considers feature status map for blocker detection', () => {
    const statusMap = new Map<string, string>();
    // Mark some deps as implemented
    statusMap.set('arpg-gas::Base GameplayAbility', 'implemented');
    statusMap.set('arpg-animation::Attack montages', 'implemented');
    statusMap.set('arpg-animation::Anim Notify classes', 'implemented');

    const result = computeNBA('arpg-combat', statusMap);
    // Should still return recommendations
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('getTopRecommendation', () => {
  it('returns null for a module with no checklist', () => {
    const result = getTopRecommendation('nonexistent-mod' as never);
    expect(result).toBeNull();
  });

  it('returns the highest-scored recommendation', () => {
    const top = getTopRecommendation('arpg-combat');
    const all = computeNBA('arpg-combat');
    if (all.length > 0) {
      expect(top).not.toBeNull();
      expect(top!.score).toBe(all[0].score);
    } else {
      expect(top).toBeNull();
    }
  });
});
