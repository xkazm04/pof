import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  ensureStructuredInsightsTable,
  saveStructuredInsight,
  getInsightsForSession,
  getInsightsForModule,
} from '@/lib/structured-insights-db';
import type { SubModuleId } from '@/types/modules';
import type { StructuredInsight } from '@/types/structured-insights';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS structured_insights');
});

function sampleInsight(over: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    id: 'si-sess-1-1000',
    sessionId: 'sess-1',
    moduleId: 'arpg-combat',
    extractedAt: '2026-06-07T10:00:00.000Z',
    entities: [{ type: 'class', value: 'AHero', parent: 'ACharacter', moduleId: 'arpg-combat' }],
    classHierarchy: [{ name: 'AHero', parent: 'ACharacter' }],
    steps: [{ order: 1, description: 'Create the class', complexity: 'low' }],
    warnings: ['Watch component init order'],
    filePaths: ['Source/PoF/Hero.cpp'],
    ...over,
  };
}

describe('structured-insights-db', () => {
  it('ensureStructuredInsightsTable is idempotent', () => {
    ensureStructuredInsightsTable();
    expect(() => ensureStructuredInsightsTable()).not.toThrow();
    const tbl = testDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='structured_insights'")
      .get();
    expect(tbl).toBeTruthy();
  });

  it('saves and round-trips an insight by session, JSON columns parsed back to arrays', () => {
    saveStructuredInsight(sampleInsight());
    const got = getInsightsForSession('sess-1');
    expect(got).not.toBeNull();
    expect(got).toEqual(sampleInsight());
  });

  it('getInsightsForSession returns null when there is no row', () => {
    ensureStructuredInsightsTable();
    expect(getInsightsForSession('missing')).toBeNull();
  });

  it('getInsightsForSession returns the most recent insight for the session', () => {
    saveStructuredInsight(sampleInsight({ id: 'si-sess-1-1000', extractedAt: '2026-06-07T10:00:00.000Z' }));
    saveStructuredInsight(
      sampleInsight({ id: 'si-sess-1-2000', extractedAt: '2026-06-07T11:00:00.000Z', warnings: ['newer'] }),
    );
    const got = getInsightsForSession('sess-1');
    expect(got?.id).toBe('si-sess-1-2000');
    expect(got?.warnings).toEqual(['newer']);
  });

  it('getInsightsForModule returns module insights newest-first, [] when none', () => {
    expect(getInsightsForModule('arpg-combat' as SubModuleId)).toEqual([]);
    saveStructuredInsight(
      sampleInsight({ id: 'si-a', sessionId: 'a', extractedAt: '2026-06-07T10:00:00.000Z' }),
    );
    saveStructuredInsight(
      sampleInsight({ id: 'si-b', sessionId: 'b', extractedAt: '2026-06-07T12:00:00.000Z' }),
    );
    saveStructuredInsight(
      sampleInsight({ id: 'si-other', sessionId: 'c', moduleId: 'arpg-loot' }),
    );
    const got = getInsightsForModule('arpg-combat' as SubModuleId);
    expect(got.map((i) => i.id)).toEqual(['si-b', 'si-a']);
  });

  it('save is upsert — re-saving the same id replaces the row', () => {
    saveStructuredInsight(sampleInsight());
    saveStructuredInsight(sampleInsight({ filePaths: ['Source/PoF/Hero2.cpp'] }));
    const got = getInsightsForSession('sess-1');
    expect(got?.filePaths).toEqual(['Source/PoF/Hero2.cpp']);
    expect(getInsightsForModule('arpg-combat' as SubModuleId)).toHaveLength(1);
  });
});
