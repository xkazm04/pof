/**
 * scan-sweep --challenge (code-quality-evaluation/B): the per-type prose suggestion
 * becomes a CLI remedy for the two classes a CLI can fix without deleting anything.
 * The prompt is the TASK body only - the ask-claude rail handler composes the header.
 */
import { describe, it, expect } from 'vitest';
import { planOracleRemedy } from '@/lib/asset-oracle/oracleRemedy';
import type { ConsistencyViolation } from '@/lib/asset-code-oracle';

function v(p: Partial<ConsistencyViolation> & Pick<ConsistencyViolation, 'type' | 'subject'>): ConsistencyViolation {
  return {
    id: `${p.type}:${p.subject}`,
    severity: 'info',
    title: 't',
    description: 'd',
    suggestion: 's',
    ...p,
  };
}

const CTX = { contentRoot: '/Game' };

describe('planOracleRemedy', () => {
  it('case 5: naming-mismatch -> one prompt with both renames, editor rename with redirectors, Do NOT delete', () => {
    const plan = planOracleRemedy('naming-mismatch', [
      v({ type: 'naming-mismatch', subject: 'Env/X_Foo.uasset', label: 'X_Foo', expected: 'SM_Foo' }),
      v({ type: 'naming-mismatch', subject: 'Chars/Q_Bar.uasset', label: 'Q_Bar', expected: 'T_Bar' }),
    ], CTX);
    expect(plan).not.toBeNull();
    expect(plan!.prompt).toContain('X_Foo -> SM_Foo');
    expect(plan!.prompt).toContain('Q_Bar -> T_Bar');
    expect(plan!.prompt).toContain('/Game/Env/X_Foo');
    expect(plan!.prompt).toMatch(/redirector/i);
    expect(plan!.prompt).toContain('Do NOT delete');
    expect(plan!.keys).toEqual(['naming-mismatch:Env/X_Foo.uasset', 'naming-mismatch:Chars/Q_Bar.uasset']);
    expect(plan!.label).toBe('Fix 2 naming mismatches');
    // the rail handler owns the project header
    expect(plan!.prompt).not.toMatch(/## Project Context/);
  });

  it('case 5: missing-asset -> a prompt to create BP_Enemy parented to AEnemy', () => {
    const plan = planOracleRemedy('missing-asset', [
      v({ type: 'missing-asset', subject: 'AEnemy', label: 'AEnemy', expected: 'BP_Enemy' }),
    ], CTX);
    expect(plan).not.toBeNull();
    expect(plan!.prompt).toContain('BP_Enemy');
    expect(plan!.prompt).toMatch(/parent(ed)? (class )?(to )?AEnemy|AEnemy as (its|the) parent/i);
    expect(plan!.label).toBe('Fix 1 missing Blueprint');
  });

  it('case 5: orphaned / unreferenced (deletes) and an empty list -> null', () => {
    expect(planOracleRemedy('orphaned-asset', [v({ type: 'orphaned-asset', subject: 'Chars/BP_Old.uasset' })], CTX)).toBeNull();
    expect(planOracleRemedy('unreferenced-asset', [v({ type: 'unreferenced-asset', subject: 'Env/T_X.uasset' })], CTX)).toBeNull();
    expect(planOracleRemedy('naming-mismatch', [], CTX)).toBeNull();
  });
});
