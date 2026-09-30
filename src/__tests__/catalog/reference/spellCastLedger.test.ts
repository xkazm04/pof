import { describe, expect, it } from 'vitest';
import {
  SPELL_CAST_LEDGER_FINDINGS,
  allSpellCastLedgers,
  auditSpellCastLedgers,
  spellCastLedger,
  withSpellCastLedgers,
  type SpellCastLedger,
} from '@/lib/catalog/reference/spellCastLedger';
import { SPELL_SPECS } from '@/lib/catalog/reference/spellSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const phaseOrder = ['check', 'add', 'consume', 'process', 'end'];

function wrapper(spell: string): ReferenceWrapper {
  return {
    wrapperId: `synthetic:${spell}`,
    sourceId: 'synthetic', file: 'spells/spelldat.tsv', technique: 'synthetic',
    key: spell, keyKind: 'column', raw: {
      id: spell, manaCost: '20', minMana: '4', manaMultiplier: '2', missiles: 'Firebolt',
    }, rawHash: 'synthetic',
    catalogId: 'spellbook', mappingVersion: 'synthetic',
    entity: {
      id: `d1-${spell}`, catalogId: 'spellbook', name: spell,
      categoryPath: [], tags: [], lifecycle: 'planned', data: { synthetic: true },
      provenance: {
        kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
        sourceFile: 'spells/spelldat.tsv', sourceRow: spell,
        licenceNote: 'test fixture', ingestedAt: 'test-time',
      },
    },
  };
}

function classRow(kind: 'attributes' | 'animations'): ReferenceWrapper {
  const row = wrapper(`class-${kind}`);
  return {
    ...row,
    file: `classes/sorcerer/${kind}.tsv`,
    catalogId: 'characters',
    raw: kind === 'attributes'
      ? { baseMag: '16', baseMagicToHit: '50', adjMana: '10', lvlMana: '2', chrMana: '2' }
      : { castingFrames: '8', castingActionFrame: '3' },
    entity: { ...row.entity, catalogId: 'characters' },
  };
}

describe('spellCastLedger', () => {
  it('covers every vanilla spell with the ordered engine phases and source rules', () => {
    const ledgers = allSpellCastLedgers();
    expect(ledgers).toHaveLength(35);
    expect(ledgers.map((ledger) => ledger.spell).sort()).toEqual(SPELL_SPECS.map((spec) => spec.spell).sort());
    for (const ledger of ledgers) {
      expect(ledger.steps.map((step) => step.phase), ledger.spell).toEqual(phaseOrder);
      expect(ledger.steps.every((step) => step.refs.length > 0), ledger.spell).toBe(true);
      expect(ledger.sourceRules.map((rule) => rule.source)).toEqual(['spellbook', 'scroll', 'staff', 'skill']);
      expect(ledger.manaCost.formula.length).toBeGreaterThan(0);
    }
  });

  it('puts Add effects before payment and distinguishes free and consumed failure branches', () => {
    const healing = spellCastLedger('Healing')!;
    expect(healing.steps[1].what).toContain('before payment');
    expect(healing.steps[2].what).toContain('Only after all initial AddMissile');

    const teleport = spellCastLedger('Teleport')!;
    expect(teleport.steps[1].branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ setsSpellFizzled: true, resource: 'free' }),
    ]));
    expect(spellCastLedger('Golem')!.steps[1].branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ setsSpellFizzled: false, resource: 'consumed' }),
    ]));
    expect(spellCastLedger('StoneCurse')!.steps[1].branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ setsSpellFizzled: true, resource: 'free' }),
      expect.objectContaining({ setsSpellFizzled: false, resource: 'consumed' }),
    ]));
  });

  it('records multi-child and undefined lifecycles without pretending a table lifetime is the process law', () => {
    expect(spellCastLedger('ChargedBolt')!.steps[1].what).toContain('floor(S/2)+3 extra');
    expect(spellCastLedger('ChainLightning')!.spawnedMissiles).toEqual(['LightningControl', 'Lightning']);
    expect(spellCastLedger('Etherealize')!.steps[1]).toMatchObject({
      phase: 'add', branches: expect.arrayContaining([expect.objectContaining({ resource: 'undefined' })]),
    });
    expect(spellCastLedger('DoomSerpents')!.initialMissiles).toEqual([]);
  });

  it('reports the existing Fire Wall S=0 duration omission as a finding only', () => {
    expect(SPELL_CAST_LEDGER_FINDINGS).toEqual([
      expect.objectContaining({
        dataset: 'spellSpecsData', spell: 'FireWall', field: 'durationTicks',
        expected: '160 when S=0; 160*(S+1) when S>0',
        actual: '160*(S+1) when S>0',
      }),
    ]);
  });

  it('cross-checks synthetic spells for formula, missile, fizzle, hit, and order disagreements', () => {
    const base = spellCastLedger('Teleport')!;
    const synthetic: SpellCastLedger = {
      ...base,
      spell: 'Synthetic',
      initialMissiles: ['LedgerMissile'],
      spawnedMissiles: [],
      manaCost: { ...base.manaCost, formula: 'ledgerMana' },
      durationRule: 'ledgerDuration',
      steps: [base.steps[1], base.steps[0], ...base.steps.slice(2)].map((step) =>
        step.phase === 'process' ? { ...step, hitResult: 'ledger-hit' } : step),
    };
    const findings = auditSpellCastLedgers([synthetic], {
      specs: [{
        spell: 'Synthetic', manaCost: 'specMana', durationTicks: 'specDuration', missiles: ['SpecMissile'],
      }],
      fizzleBranches: [{
        spell: 'Synthetic', setsSpellFizzled: false, resource: 'consumed', refs: ['synthetic:fizzle'],
      }],
      hitSources: [{ spell: 'Synthetic', hitResult: 'source-hit', refs: ['synthetic:hit'] }],
    });
    expect(findings.map((finding) => finding.field)).toEqual(expect.arrayContaining([
      'manaCost', 'missiles', 'durationTicks', 'stepOrder', 'fizzleBranches', 'hitResult',
    ]));
  });

  it('attaches data.castLedger only to promoted known spell rows', () => {
    const rows = [wrapper('Firebolt'), wrapper('Synthetic')];
    const [firebolt, unknown] = withSpellCastLedgers(rows, [...rows, classRow('attributes'), classRow('animations')]);
    expect(firebolt.entity.data.castLedger).toMatchObject({ spell: 'Firebolt', instantiated: true });
    expect(unknown.entity.data.castLedger).toBeUndefined();
    expect(firebolt.raw).toEqual({ id: 'Firebolt', manaCost: '20', minMana: '4', manaMultiplier: '2', missiles: 'Firebolt' });
  });
});
