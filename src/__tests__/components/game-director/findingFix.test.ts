import { describe, it, expect } from 'vitest';
import {
  findingFixModuleId,
  buildFindingFixFeature,
  findingFixSessionKey,
} from '@/components/modules/game-director/findingFix';
import type { PlaytestFinding } from '@/types/game-director';

function makeFinding(overrides: Partial<PlaytestFinding> = {}): PlaytestFinding {
  return {
    id: 'f-1',
    sessionId: 's-1',
    category: 'gameplay-feel',
    severity: 'high',
    title: 'Attack feels sluggish',
    description: 'Combo window has a 200ms dead zone.',
    relatedModule: 'arpg-combat',
    screenshotRef: null,
    gameTimestamp: 45,
    suggestedFix: 'Reduce combo window gap to 80ms.',
    confidence: 85,
    createdAt: '2026-01-01T00:00:00.000Z',
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
    ...overrides,
  };
}

describe('findingFixModuleId', () => {
  it('uses relatedModule when it names a real sub-module', () => {
    expect(findingFixModuleId(makeFinding({ relatedModule: 'arpg-combat' }))).toBe('arpg-combat');
    expect(findingFixModuleId(makeFinding({ relatedModule: 'arpg-save' }))).toBe('arpg-save');
  });

  it('derives a sub-module from category when relatedModule is null', () => {
    expect(findingFixModuleId(makeFinding({ relatedModule: null, category: 'ai-behavior' }))).toBe('arpg-enemy-ai');
    expect(findingFixModuleId(makeFinding({ relatedModule: null, category: 'audio-issue' }))).toBe('audio');
    expect(findingFixModuleId(makeFinding({ relatedModule: null, category: 'ux-problem' }))).toBe('arpg-ui');
  });

  it('derives from category when relatedModule is not a real sub-module', () => {
    expect(findingFixModuleId(makeFinding({ relatedModule: 'totally-made-up', category: 'save-load' }))).toBe('arpg-save');
  });

  it('falls back to arpg-polish for unmapped cross-cutting findings', () => {
    expect(findingFixModuleId(makeFinding({ relatedModule: null, category: 'performance' }))).toBe('arpg-polish');
  });
});

describe('buildFindingFixFeature', () => {
  it('uses the finding title as the work item and emits null quality / no files', () => {
    const feature = buildFindingFixFeature(makeFinding());
    expect(feature.featureName).toBe('Attack feels sluggish');
    expect(feature.qualityScore).toBeNull();
    expect(feature.filePaths).toEqual([]);
  });

  it('folds description, suggested fix, and observation metadata into nextSteps', () => {
    const feature = buildFindingFixFeature(makeFinding());
    expect(feature.nextSteps).toContain('Combo window has a 200ms dead zone.');
    expect(feature.nextSteps).toContain('Reduce combo window gap to 80ms.');
    expect(feature.nextSteps).toContain('related module: arpg-combat');
    expect(feature.nextSteps).toContain('observed at game time 45s');
    expect(feature.nextSteps).toContain('severity: high');
  });

  it('omits empty suggested fix and missing timestamp gracefully', () => {
    const feature = buildFindingFixFeature(makeFinding({ suggestedFix: '', gameTimestamp: null }));
    expect(feature.nextSteps).not.toContain('Suggested fix');
    expect(feature.nextSteps).not.toContain('game time');
    expect(feature.nextSteps).toContain('Combo window has a 200ms dead zone.');
  });
});

describe('findingFixSessionKey', () => {
  it('encodes the originating finding id', () => {
    expect(findingFixSessionKey('f-42')).toBe('gd-fix-f-42');
  });
});
