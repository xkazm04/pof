// /diablo W12 (D4) — spell seeds from a reference row, graded by the REAL spellbook Effect Logic step. Diablo I has no
// cooldowns: the seed declares a RESOURCE gate beside the mana cost instead of inventing one, and the step's cast-gate
// checker accepts it — while the seeded step as a whole never grades pass. Synthetic rows.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { seedSpellSteps } from '@/lib/catalog/reference/stepSeeds';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { allOfMembers } from '@/lib/catalog/acceptance/combinators';

const spellSpec = DIABLO1.tables.find((t) => t.catalogId === 'spellbook')!;
const COLS = Object.keys(spellSpec.map);
const tsv = (rows: Record<string, string>[]) => [COLS.join('\t'), ...rows.map((r) => COLS.map((c) => r[c] ?? '').join('\t'))].join('\n');
const row = (r: Record<string, string>) => wrapTable(DIABLO1, spellSpec, tsv([r]), 't0').wrappers[0];

const bolt = row({ id: 'TestBolt', name: 'Test Bolt', manaCost: '6', flags: 'Fire,Targeted', missiles: 'TestBolt' });
const heal = row({ id: 'TestHeal', name: 'Test Heal', manaCost: '5', flags: 'Magic,AllowedInTown', missiles: 'TestHeal' });
const util = row({ id: 'TestUtil', name: 'Test Util', manaCost: '7', flags: 'AllowedInTown', missiles: 'TestUtil' });

describe('seedSpellSteps', () => {
  it('seeds Effect Logic with the element, the mana cost and a declared resource gate — no cooldown', () => {
    const [seed] = seedSpellSteps(bolt);
    expect(seed.step).toBe('Effect Logic');
    const e = seed.data.effect as Record<string, unknown>;
    expect(e).toMatchObject({ damageType: 'Fire', manaCost: 6, gatedBy: 'resource' });
    expect(e.cooldown).toBeUndefined();
    expect(seed.data.sourced).toBeDefined();
    expect(e.baseDamage).toBe(REFERENCE_GAP);
  });

  it('declares a missing element as a gap', () => {
    expect((seedSpellSteps(heal)[0].data.effect as Record<string, unknown>).damageType).toBe('Magic');
    const [seed] = seedSpellSteps(util);
    expect((seed.data.effect as Record<string, unknown>).damageType).toBe(REFERENCE_GAP);
    expect(seed.gaps.join(' ')).toMatch(/no element/);
  });

  it('passes the real step\'s cast gate, and no reason names the cooldown', () => {
    const step = getCatalogPipeline('spellbook')!.steps.find((s) => s.label === 'Effect Logic')!;
    const data = seedSpellSteps(bolt)[0].data;
    const members = allOfMembers(step.accept!)!.map((c) => c(data));
    expect(members.find((r) => r.label.startsWith('Cast gate'))?.status).toBe('pass');
    for (const r of members) expect(r.reason ?? '').not.toMatch(/cooldown/);
  });
});
