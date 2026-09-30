// /diablo W03 (decision D12): a step's wiring contract reaches the produce prompt ONLY as a
// world-neutral declaration. It used to be extracted by running the step's produce stub, so one
// PoF entity's content reached every entity's live prompt — three Diablo zombies were produced
// with PoF's "Ground Slam" and the shape-only checker passed it.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import type { StepContractDecl } from '@/lib/catalog/stepSpec';

const declText = (c: StepContractDecl | undefined, criteria: string[] = []) =>
  [...(c ? [c.grantedBy, c.activatedBy, c.verification, ...c.dependencies] : []), ...criteria].join('\n');

/** Every seeded entity's id and name, as whole-token patterns (short/generic tokens skipped). */
function seededTokens(): { token: string; re: RegExp; where: string }[] {
  const out: { token: string; re: RegExp; where: string }[] = [];
  const seen = new Set<string>();
  for (const [catalogId, byId] of Object.entries(seedAllCatalogs())) {
    for (const e of Object.values(byId)) {
      // Ids match case-insensitively; names case-SENSITIVELY — a name is a proper noun, and the
      // lowercase common word ("a stat block", "a melee attack") is how neutral prose says it.
      for (const [t, flags] of [[e.id, 'i'], [e.name, '']] as const) {
        if (typeof t !== 'string' || t.length < 5 || seen.has(t)) continue;
        seen.add(t);
        const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out.push({ token: t, re: new RegExp(`(^|[^\\w-])${esc}($|[^\\w-])`, flags), where: catalogId });
      }
    }
  }
  return out;
}

describe('contract declarations are world-neutral', () => {
  it('no declaration names a seeded entity of any catalog', () => {
    const tokens = seededTokens();
    expect(tokens.length).toBeGreaterThan(100); // the census is real
    const leaks: string[] = [];
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      if (!s.contract && !s.criteria) continue;
      const text = declText(s.contract, s.criteria);
      for (const t of tokens) if (t.re.test(text)) leaks.push(`${p.catalogId} · ${s.label}: "${t.token}" (${t.where})`);
    }
    expect(leaks).toEqual([]);
  });

  it('every step whose checker grades a wiring contract DECLARES one (137/137 at W03)', () => {
    const undeclared: string[] = [];
    let graded = 0;
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      if (!requiredFieldsOf(s.accept).some((r) => r.field.endsWith('wiringContract'))) continue;
      graded++;
      if (!s.contract) undeclared.push(`${p.catalogId} · ${s.label}`);
    }
    expect(graded).toBeGreaterThan(100);
    expect(undeclared).toEqual([]);
  });

  it('a declaration sits where its checker grades the contract', () => {
    const wrong: string[] = [];
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      if (!s.contract) continue;
      const path = s.contract.field ? `${s.contract.field}.wiringContract` : 'wiringContract';
      if (!requiredFieldsOf(s.accept).some((r) => r.field === path)) wrong.push(`${p.catalogId} · ${s.label}: ${path}`);
    }
    expect(wrong).toEqual([]);
  });
});
