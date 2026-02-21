import { describe, it, expect } from 'vitest';
import {
  MODULE_PREREQUISITES,
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
  computeBlockers,
  getRecommendedNextModules,
  getUnmetPrerequisites,
} from '@/lib/feature-definitions';

describe('MODULE_PREREQUISITES', () => {
  it('is a non-empty record', () => {
    expect(Object.keys(MODULE_PREREQUISITES).length).toBeGreaterThan(0);
  });

  it('defines arpg-combat as depending on arpg-gas and arpg-animation', () => {
    expect(MODULE_PREREQUISITES['arpg-combat']).toEqual(
      expect.arrayContaining(['arpg-gas', 'arpg-animation']),
    );
  });

  it('defines audio as having no prerequisites', () => {
    expect(MODULE_PREREQUISITES['audio']).toEqual([]);
  });
});

describe('MODULE_FEATURE_DEFINITIONS', () => {
  it('contains feature definitions for arpg-character', () => {
    const features = MODULE_FEATURE_DEFINITIONS['arpg-character'];
    expect(features).toBeDefined();
    expect(features!.length).toBeGreaterThan(0);
  });

  it('features have required fields', () => {
    const features = MODULE_FEATURE_DEFINITIONS['arpg-character']!;
    for (const f of features) {
      expect(f.featureName).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.description).toBeTruthy();
    }
  });

  it('cross-module dependencies use moduleId::featureName format', () => {
    const combatFeatures = MODULE_FEATURE_DEFINITIONS['arpg-combat'] ?? [];
    const crossDeps = combatFeatures
      .flatMap((f) => f.dependsOn ?? [])
      .filter((d) => d.includes('::'));
    expect(crossDeps.length).toBeGreaterThan(0);
    for (const dep of crossDeps) {
      expect(dep).toMatch(/^[\w-]+::[\w\s/()]+$/);
    }
  });
});

describe('buildDependencyMap', () => {
  it('returns a non-empty map', () => {
    const map = buildDependencyMap();
    expect(map.size).toBeGreaterThan(0);
  });

  it('keys follow moduleId::featureName format', () => {
    const map = buildDependencyMap();
    for (const key of map.keys()) {
      expect(key).toContain('::');
    }
  });

  it('resolves direct dependencies', () => {
    const map = buildDependencyMap();
    const info = map.get('arpg-character::AARPGPlayerCharacter');
    expect(info).toBeDefined();
    expect(info!.deps.length).toBeGreaterThan(0);
    expect(info!.deps.some((d) => d.featureName === 'AARPGCharacterBase')).toBe(true);
  });

  it('computes transitive chains', () => {
    const map = buildDependencyMap();
    // WASD movement depends on AARPGPlayerController → Enhanced Input actions (transitive)
    const info = map.get('arpg-character::WASD movement');
    expect(info).toBeDefined();
    // Chain should include transitive deps beyond direct ones
    expect(info!.chain.length).toBeGreaterThanOrEqual(info!.deps.length);
  });
});

describe('computeBlockers', () => {
  it('marks all deps as blockers when no statuses are provided', () => {
    const depMap = buildDependencyMap();
    const statusMap = new Map<string, string>();
    const result = computeBlockers(depMap, statusMap);

    // A feature with deps should be blocked when none are 'implemented'
    const info = result.get('arpg-character::AARPGPlayerCharacter');
    expect(info).toBeDefined();
    expect(info!.isBlocked).toBe(true);
    expect(info!.blockers.length).toBeGreaterThan(0);
  });

  it('unblocks a feature when all deps are implemented', () => {
    const depMap = buildDependencyMap();
    const statusMap = new Map<string, string>();
    // Mark AARPGCharacterBase as implemented
    statusMap.set('arpg-character::AARPGCharacterBase', 'implemented');
    const result = computeBlockers(depMap, statusMap);

    const info = result.get('arpg-character::AARPGPlayerCharacter');
    expect(info).toBeDefined();
    expect(info!.isBlocked).toBe(false);
    expect(info!.blockers.length).toBe(0);
  });

  it('does not mutate the original dependency map', () => {
    const depMap = buildDependencyMap();
    const original = depMap.get('arpg-character::AARPGPlayerCharacter');
    const origBlockerCount = original!.blockers.length;

    const statusMap = new Map<string, string>();
    statusMap.set('arpg-character::AARPGCharacterBase', 'implemented');
    computeBlockers(depMap, statusMap);

    // Original should be unchanged
    expect(depMap.get('arpg-character::AARPGPlayerCharacter')!.blockers.length).toBe(origBlockerCount);
  });
});

describe('getRecommendedNextModules', () => {
  it('returns empty array when current module progress is below 50%', () => {
    const result = getRecommendedNextModules(
      'arpg-character',
      { 'arpg-character': { 'item1': true } },
      { 'arpg-character': 10 },
    );
    expect(result).toEqual([]);
  });

  it('recommends dependent modules when current module is substantially complete', () => {
    // arpg-character is a prereq for arpg-animation and arpg-gas
    const progress: Record<string, Record<string, boolean>> = {
      'arpg-character': {},
    };
    // Make arpg-character 80% complete (8 of 10 items)
    for (let i = 0; i < 8; i++) progress['arpg-character'][`item${i}`] = true;
    for (let i = 8; i < 10; i++) progress['arpg-character'][`item${i}`] = false;

    const sizes: Record<string, number> = {
      'arpg-character': 10,
      'arpg-animation': 5,
      'arpg-gas': 5,
    };

    const result = getRecommendedNextModules('arpg-character', progress, sizes);
    expect(result.length).toBeGreaterThan(0);
    // All recommended modules should have arpg-character as a prereq
    for (const rec of result) {
      expect(MODULE_PREREQUISITES[rec.moduleId]).toContain('arpg-character');
    }
  });

  it('caps results to 3 recommendations', () => {
    const progress: Record<string, Record<string, boolean>> = {
      'arpg-character': {},
    };
    for (let i = 0; i < 10; i++) progress['arpg-character'][`item${i}`] = true;

    const sizes: Record<string, number> = { 'arpg-character': 10 };
    // Give all dependent modules sizes so they qualify
    for (const [mod] of Object.entries(MODULE_PREREQUISITES)) {
      if (!sizes[mod]) sizes[mod] = 5;
    }

    const result = getRecommendedNextModules('arpg-character', progress, sizes);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe('getUnmetPrerequisites', () => {
  it('returns empty array for modules with no prerequisites', () => {
    expect(getUnmetPrerequisites('audio', {}, {})).toEqual([]);
  });

  it('returns all prerequisites when none have progress', () => {
    const result = getUnmetPrerequisites('arpg-combat', {}, {});
    expect(result.length).toBe(MODULE_PREREQUISITES['arpg-combat']!.length);
  });

  it('excludes prerequisites that are >= 50% complete', () => {
    const progress: Record<string, Record<string, boolean>> = {
      'arpg-gas': {},
    };
    // Make arpg-gas 60% complete (6 of 10)
    for (let i = 0; i < 6; i++) progress['arpg-gas'][`item${i}`] = true;

    const sizes = { 'arpg-gas': 10, 'arpg-animation': 5 };
    const result = getUnmetPrerequisites('arpg-combat', progress, sizes);

    // arpg-gas should NOT appear (60% >= 50%)
    expect(result.find((r) => r.moduleId === 'arpg-gas')).toBeUndefined();
    // arpg-animation should appear (0% < 50%)
    expect(result.find((r) => r.moduleId === 'arpg-animation')).toBeDefined();
  });
});
