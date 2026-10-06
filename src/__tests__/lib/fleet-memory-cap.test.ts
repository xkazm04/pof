import { describe, it, expect } from 'vitest';
import { planFleetMemoryPrune, countFleetMemoryEntries, FLEET_MEMORY_ENTRY } from '@/lib/fleet-memory-cap';

const HEADER = ['# Fleet Shared Memory', '', 'Cap: 200 entries.', '', '## Entries', ''];
const entry = (day: number, kind: string, n: number) =>
  `- [2026-09-${String(day).padStart(2, '0')}] [area] ${kind}: line ${n}`;

/** Header + the given entry lines, newline-terminated like the real file. */
const file = (entries: string[]) => [...HEADER, ...entries].join('\n') + '\n';

const entryLines = (text: string) => text.split('\n').filter((l) => FLEET_MEMORY_ENTRY.test(l));

describe('planFleetMemoryPrune', () => {
  it('is a no-op when entries are at or under the cap', () => {
    const text = file([entry(1, 'DELIVERED', 1), entry(2, 'DECISION', 2), entry(3, 'DELIVERED', 3)]);
    for (const cap of [3, 10]) {
      const plan = planFleetMemoryPrune(text, cap);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      expect(plan.kept).toBe(text);
      expect(plan.archived).toEqual([]);
    }
  });

  it('counts entries, not file lines — a long header does not push it over', () => {
    const text = file([entry(1, 'DELIVERED', 1)]) + '\n'.repeat(500);
    expect(planFleetMemoryPrune(text, 1).ok).toBe(true);
    expect(countFleetMemoryEntries(text)).toBe(1);
  });

  it('archives the oldest DELIVERED lines first, and only as many as needed', () => {
    const lines = [
      entry(1, 'DELIVERED', 1), entry(2, 'DECISION', 2), entry(3, 'DELIVERED', 3),
      entry(4, 'DELIVERED', 4), entry(5, 'DELIVERED', 5),
    ];
    const plan = planFleetMemoryPrune(file(lines), 3);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.archived).toEqual([lines[0], lines[2]]);
    expect(entryLines(plan.kept)).toEqual([lines[1], lines[3], lines[4]]);
    expect(plan.entriesBefore).toBe(5);
    expect(plan.entriesAfter).toBe(3);
  });

  it('never archives a DECISION or CONVENTION line, even when they are the oldest', () => {
    const lines = [
      entry(1, 'DECISION', 1), entry(2, 'CONVENTION', 2), entry(3, 'DELIVERED', 3), entry(4, 'DELIVERED', 4),
    ];
    const plan = planFleetMemoryPrune(file(lines), 3);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.archived).toEqual([lines[2]]);
    expect(plan.archived.some((l) => /\] (DECISION|CONVENTION):/.test(l))).toBe(false);
    expect(plan.kept).toContain(lines[0]);
    expect(plan.kept).toContain(lines[1]);
  });

  it('loses and alters nothing: kept + archived = the original entry lines, header intact', () => {
    const lines = Array.from({ length: 12 }, (_, i) => entry(i + 1, i % 3 === 0 ? 'DECISION' : 'DELIVERED', i));
    const text = file(lines);
    const plan = planFleetMemoryPrune(text, 7);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect([...entryLines(plan.kept), ...plan.archived].sort()).toEqual([...lines].sort());
    expect(plan.kept.split('\n').slice(0, HEADER.length)).toEqual(HEADER);
    expect(plan.kept.endsWith('\n')).toBe(true);
    expect(countFleetMemoryEntries(plan.kept)).toBe(7);
  });

  it('preserves CRLF line endings on the lines it keeps and archives', () => {
    const lines = [entry(1, 'DELIVERED', 1), entry(2, 'DECISION', 2)];
    const text = file(lines).replace(/\n/g, '\r\n');
    const plan = planFleetMemoryPrune(text, 1);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.archived).toEqual([lines[0] + '\r']);
    expect(plan.kept).toContain(lines[1] + '\r\n');
  });

  it('fails, writing nothing, when DELIVERED lines run out while still over the cap', () => {
    const lines = [
      entry(1, 'DECISION', 1), entry(2, 'DECISION', 2), entry(3, 'CONVENTION', 3), entry(4, 'DELIVERED', 4),
    ];
    const plan = planFleetMemoryPrune(file(lines), 2);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toBe('delivered-exhausted');
    expect(plan.protectedEntries).toBe(3);
    expect(plan.deliveredEntries).toBe(1);
    expect(plan.message).toContain('3 DECISION/CONVENTION');
    expect(plan.message).toContain('human must retire');
  });

  it('succeeds when archiving every DELIVERED line lands exactly on the cap', () => {
    const lines = [entry(1, 'DECISION', 1), entry(2, 'DELIVERED', 2), entry(3, 'DELIVERED', 3)];
    const plan = planFleetMemoryPrune(file(lines), 1);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.archived).toHaveLength(2);
    expect(plan.entriesAfter).toBe(1);
  });
});
