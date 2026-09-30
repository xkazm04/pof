/**
 * scan-sweep --challenge (code-quality-evaluation/B): a stable violation key lets a
 * re-scan say what is new, what persists, and what was resolved since the last scan.
 */
import { describe, it, expect } from 'vitest';
import { diffOracleScans } from '@/lib/asset-oracle/oracleDiff';

describe('diffOracleScans', () => {
  it('case 4: tags new/persisting against the previous keys and lists the resolved ones', () => {
    const d = diffOracleScans(
      ['naming-mismatch:Env/X_Foo.uasset', 'missing-asset:AEnemy'],
      [{ id: 'missing-asset:AEnemy' }, { id: 'orphaned-asset:Chars/BP_Old.uasset' }],
    );
    expect(d.hasPrevious).toBe(true);
    expect(d.status).toEqual({
      'missing-asset:AEnemy': 'persisting',
      'orphaned-asset:Chars/BP_Old.uasset': 'new',
    });
    expect(d.resolved).toEqual(['naming-mismatch:Env/X_Foo.uasset']);
    expect(d.newCount).toBe(1);
  });

  it('case 4: no previous keys -> hasPrevious false and no status tags', () => {
    const d = diffOracleScans(null, [{ id: 'missing-asset:AEnemy' }]);
    expect(d.hasPrevious).toBe(false);
    expect(d.status).toEqual({});
    expect(d.resolved).toEqual([]);
    expect(d.newCount).toBe(0);
  });
});
