/**
 * planCanonSync — the pure drift classifier between the SHIPPED canon (the profile seeds in code)
 * and the project_rules rows. Each row records the hash of the shipped text it was last written
 * from (`shippedHash`); that provenance is what tells a stale seed (follow it) from an operator's
 * edit (ask). A legacy row with no recorded offer always asks.
 */
import { describe, it, expect } from 'vitest';
import { planCanonSync, canonTextHash, type CanonRow } from '@/lib/catalog/canon/canonSync';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const rule = (id: string, body: string, profile?: string): ProjectRule => ({
  id, category: 'game', scope: 'global', title: `T ${id}`, body, refs: [], ...(profile ? { profile } : {}),
});
const row = (id: string, body: string, shippedHash: string | null, profile?: string): CanonRow => ({
  ...rule(id, body, profile), shippedHash,
});
const hash = (id: string, body: string, profile?: string) => canonTextHash(rule(id, body, profile));
const verdictOf = (plan: ReturnType<typeof planCanonSync>, id: string) => plan.entries.find((e) => e.id === id)?.verdict;

describe('planCanonSync', () => {
  it('follow: a row untouched since its recorded offer follows the moved shipped text (auto-apply)', () => {
    const plan = planCanonSync([rule('a', 'v2')], [row('a', 'v1', hash('a', 'v1'))], new Set(['a']));
    const a = plan.entries.find((e) => e.id === 'a')!;
    expect(a.verdict).toBe('follow');
    expect(a.recordedHash).toBe(hash('a', 'v1'));
    expect(a.currentHash).toBe(hash('a', 'v2'));
    expect(plan.autoApply.map((r) => r.id)).toEqual(['a']);
    expect(plan.autoApply[0].body).toBe('v2');
    expect(plan.findings).toEqual([]);
  });

  it('conflict: an operator-edited row whose shipped text moved asks and is never auto-applied; unmoved -> edited', () => {
    const moved = planCanonSync([rule('a', 'v2')], [row('a', 'operator text', hash('a', 'v1'))], new Set(['a']));
    expect(verdictOf(moved, 'a')).toBe('conflict');
    expect(moved.autoApply).toEqual([]);
    expect(moved.findings.map((f) => f.id)).toEqual(['a']);

    const same = planCanonSync([rule('a', 'v1')], [row('a', 'operator text', hash('a', 'v1'))], new Set(['a']));
    expect(verdictOf(same, 'a')).toBe('edited');
    expect(same.findings).toEqual([]);
    expect(same.autoApply).toEqual([]);
  });

  it('legacy rows (no recorded offer): differing -> unrecorded (asks); equal -> fresh and listed for stamping', () => {
    const differs = planCanonSync([rule('a', 'v2')], [row('a', 'v1', null)], new Set(['a']));
    expect(verdictOf(differs, 'a')).toBe('unrecorded');
    expect(differs.autoApply).toEqual([]);
    expect(differs.findings.map((f) => f.id)).toEqual(['a']);

    const equal = planCanonSync([rule('a', 'v2')], [row('a', 'v2', null)], new Set(['a']));
    expect(verdictOf(equal, 'a')).toBe('fresh');
    expect(equal.stamp).toEqual([{ id: 'a', hash: hash('a', 'v2') }]);
    expect(equal.findings).toEqual([]);
  });

  it('deleted stays deleted; a no-longer-shipped seed id is orphaned; a never-offered absent id is missing', () => {
    const plan = planCanonSync(
      [rule('gone', 'x', 'diablo1'), rule('new', 'n')],
      [row('d1-hud', 'old hud law', null, 'diablo1'), row('mine', 'operator rule', null)],
      new Set(['gone', 'd1-hud']),
    );
    expect(verdictOf(plan, 'gone')).toBeUndefined(); // offered, then deleted: nothing re-inserts it
    expect(plan.autoApply.find((r) => r.id === 'gone')).toBeUndefined();
    expect(verdictOf(plan, 'd1-hud')).toBe('orphaned');
    expect(verdictOf(plan, 'new')).toBe('missing');
    expect(verdictOf(plan, 'mine')).toBeUndefined(); // an operator's own rule is not canon drift
    expect(plan.findings.map((f) => `${f.id}:${f.verdict}`).sort()).toEqual(['d1-hud:orphaned', 'new:missing']);
  });
});
