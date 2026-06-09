import { describe, it, expect } from 'vitest';
import { fingerprintFinding, deduplicateFindings } from '@/lib/evaluator/finding-collector';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

function mk(over: Partial<EvalFinding> & { description: string }): EvalFinding {
  return {
    id: 'x',
    scanId: 's',
    moduleId: 'arpg-combat' as SubModuleId,
    pass: 'structure',
    category: 'General',
    severity: 'medium',
    file: 'a.cpp',
    line: 1,
    suggestedFix: '',
    effort: 'small',
    timestamp: 0,
    ...over,
  };
}

describe('fingerprintFinding', () => {
  it('ignores line number by default (cross-scan stability)', () => {
    const a = fingerprintFinding(mk({ description: 'same', line: 10 }));
    const b = fingerprintFinding(mk({ description: 'same', line: 99 }));
    expect(a).toBe(b);
  });

  it('includes the line number when asked (dedup mode)', () => {
    const a = fingerprintFinding(mk({ description: 'same', line: 10 }), { includeLine: true });
    const b = fingerprintFinding(mk({ description: 'same', line: 99 }), { includeLine: true });
    expect(a).not.toBe(b);
  });

  it('normalizes case and trailing punctuation so fuzzy duplicates collide', () => {
    const a = fingerprintFinding(mk({ description: 'Missing null check.' }));
    const b = fingerprintFinding(mk({ description: 'missing null check' }));
    expect(a).toBe(b);
  });
});

describe('deduplicateFindings (still keeps higher severity)', () => {
  it('collapses same file+line+description and keeps the most severe', () => {
    const findings = [
      mk({ id: '1', description: 'dup', severity: 'low', line: 5 }),
      mk({ id: '2', description: 'dup', severity: 'critical', line: 5 }),
    ];
    const deduped = deduplicateFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].severity).toBe('critical');
  });

  it('keeps findings on different lines as distinct', () => {
    const findings = [
      mk({ id: '1', description: 'dup', line: 5 }),
      mk({ id: '2', description: 'dup', line: 8 }),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });
});
