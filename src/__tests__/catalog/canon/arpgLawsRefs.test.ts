// ARPG-LAWS refs (scan-sweep catalog-seed-data/B): a canon rule's `refs` entry must land on a real
// heading of the doc it names, so the law is auditable backwards (registry: design-canon-as-executable-law).
// The refs are rendered into prompts and the editor; changing one changes canonTextHash, so the
// second test pins the sync consequence: an untouched row FOLLOWS (auto-applied), nothing conflicts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { planCanonSync, canonTextHash, type CanonRow } from '@/lib/catalog/canon/canonSync';

const DOC = 'docs/catalog/ARPG-LAWS.md';
const lines = readFileSync(resolve(process.cwd(), DOC), 'utf8').split(/\r?\n/);

/** GitHub heading slug: lowercase, drop punctuation except hyphen/space, spaces to hyphens. */
const slugOf = (h: string): string =>
  h.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
const slugs = new Set(lines.filter((l) => /^#{1,6}\s/.test(l)).map((l) => slugOf(l.replace(/^#+\s+/, ''))));

const arpgRefs = CANON_SEED.flatMap((r) =>
  (r.refs ?? []).filter((x) => x.startsWith(`${DOC}#`)).map((x) => ({ id: r.id, ref: x })),
);

describe('ARPG-LAWS canon refs', () => {
  it('slug rule matches a known heading', () => {
    expect(slugOf('1. Item Rarity & Item Level')).toBe('1-item-rarity--item-level');
    expect(slugs.has('1-item-rarity--item-level')).toBe(true);
  });

  it('every ref resolves to a heading anchor in the doc', () => {
    expect(arpgRefs.length).toBe(20);
    const dead = arpgRefs.filter(({ ref }) => !slugs.has(ref.slice(DOC.length + 1)));
    expect(dead.map((d) => `${d.id} ${d.ref}`)).toEqual([]);
  });

  it('rewriting a legacy "#N" ref plans as follow for an untouched row, never conflict', () => {
    const legacy = (id: string) => {
      const r = CANON_SEED.find((x) => x.id === id)!;
      const refs = (r.refs ?? []).map((x) => x.replace(/#(\d+)-.*$/, '#$1'));
      return { ...r, refs };
    };
    const ids = arpgRefs.map((a) => a.id);
    const rows: CanonRow[] = ids.map((id) => {
      const old = legacy(id);
      return { ...old, shippedHash: canonTextHash(old) };
    });
    const plan = planCanonSync(ids.map((id) => CANON_SEED.find((x) => x.id === id)!), rows, new Set(ids));
    const count = (v: string) => plan.entries.filter((e) => e.verdict === v).length;
    expect(count('follow')).toBe(ids.length);
    expect(count('conflict')).toBe(0);
  });
});
