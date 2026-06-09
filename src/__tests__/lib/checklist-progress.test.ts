import { describe, it, expect } from 'vitest';
import { countChecklist, countAllChecklists } from '@/lib/checklist-progress';
import { SUB_MODULES } from '@/lib/module-registry';

const mod = (ids: string[]) => ({
  checklist: ids.map((id) => ({ id, label: id, description: '', prompt: '' })),
});

describe('countChecklist', () => {
  it('counts only checked items, with total from the registry checklist', () => {
    const result = countChecklist(mod(['a', 'b', 'c']), { a: true, b: false });
    expect(result).toEqual({ done: 1, total: 3 });
  });

  it('treats undefined progress as nothing done', () => {
    expect(countChecklist(mod(['a', 'b']), undefined)).toEqual({ done: 0, total: 2 });
  });

  it('returns zeroes when the module has no checklist', () => {
    expect(countChecklist({}, { a: true })).toEqual({ done: 0, total: 0 });
  });

  it('ignores progress keys that are not registry checklist items (total stays registry-based)', () => {
    // "ghost" was toggled but is no longer a checklist item — it must not inflate done or total.
    const result = countChecklist(mod(['a', 'b']), { a: true, ghost: true });
    expect(result).toEqual({ done: 1, total: 2 });
  });
});

describe('countAllChecklists', () => {
  const registryTotal = SUB_MODULES.reduce((s, m) => s + (m.checklist?.length ?? 0), 0);

  it('aggregates the whole registry with nothing done for empty progress', () => {
    const result = countAllChecklists({});
    expect(result.done).toBe(0);
    expect(result.total).toBe(registryTotal);
    expect(result.total).toBeGreaterThan(0);
  });

  it('treats undefined progress the same as empty progress', () => {
    expect(countAllChecklists(undefined)).toEqual({ done: 0, total: registryTotal });
  });

  it('counts checked items across modules without changing the registry-based total', () => {
    const target = SUB_MODULES.find((m) => (m.checklist?.length ?? 0) > 0)!;
    const firstItem = target.checklist![0].id;
    const result = countAllChecklists({ [target.id]: { [firstItem]: true } });
    expect(result.done).toBe(1);
    expect(result.total).toBe(registryTotal);
  });

  it('equals the sum of per-module countChecklist results', () => {
    const progress: Record<string, Record<string, boolean>> = {};
    for (const m of SUB_MODULES) {
      const first = m.checklist?.[0];
      if (first) progress[m.id] = { [first.id]: true };
    }
    const expected = SUB_MODULES.reduce(
      (acc, m) => {
        const c = countChecklist(m, progress[m.id]);
        return { done: acc.done + c.done, total: acc.total + c.total };
      },
      { done: 0, total: 0 },
    );
    expect(countAllChecklists(progress)).toEqual(expected);
  });
});
