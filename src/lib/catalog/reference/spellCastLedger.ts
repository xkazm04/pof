/** Ordered spell-cast truth: validation, AddMissile side effects, payment, and missile processing. */
import { PLAYER_SPELL_HIT_SOURCES_DATA } from '@/lib/catalog/reference/playerSpellHitsData';
import {
  SPELL_FIZZLE_BRANCHES_DATA,
  SPELL_FIZZLE_RULE_DATA,
} from '@/lib/catalog/reference/spellMechanicsData';
import { SPELL_CAST_LEDGER_DATA } from '@/lib/catalog/reference/spellCastLedgerData';
import { SPELL_SPECS_DATA } from '@/lib/catalog/reference/spellSpecsData';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type SpellCastPhase = 'check' | 'add' | 'consume' | 'process' | 'end';
export type SpellCastSource = 'spellbook' | 'scroll' | 'staff' | 'skill';
export type SpellCastResourceOutcome = 'free' | 'consumed' | 'none' | 'undefined';

export interface SpellCastBranch {
  readonly condition: string;
  readonly outcome: string;
  readonly resource: SpellCastResourceOutcome;
  readonly setsSpellFizzled?: boolean;
  /** Identifies a claim duplicated from an existing dataset for automated parity checks. */
  readonly sourceDataset?: 'spellMechanicsData';
  readonly refs: readonly string[];
}

export interface SpellCastStep {
  readonly phase: SpellCastPhase;
  readonly what: string;
  readonly branches?: readonly SpellCastBranch[];
  readonly hitResult?: string;
  readonly refs: readonly string[];
}

export interface SpellCastManaRule {
  /** Effective displayed formula for the spell's ordinary source, matching spellSpecsData notation. */
  readonly formula: string;
  /** GetManaAmount even when an ordinary Skill cast never calls it. */
  readonly engineFormula: string;
  readonly symbols: Readonly<Record<string, string>>;
  readonly refs: readonly string[];
}

export interface SpellCastSourceRule {
  readonly source: SpellCastSource;
  readonly check: string;
  readonly consume: string;
  readonly level: string;
  readonly refs: readonly string[];
}

export interface SpellCastLedger {
  readonly spell: string;
  readonly expansion: 'diablo';
  readonly initialMissiles: readonly string[];
  readonly spawnedMissiles: readonly string[];
  readonly manaCost: SpellCastManaRule;
  readonly durationRule: string;
  readonly sourceRules: readonly SpellCastSourceRule[];
  readonly steps: readonly SpellCastStep[];
  readonly refs: readonly string[];
}

export interface SpellCastLedgerFinding {
  readonly dataset: 'spellSpecsData' | 'spellMechanicsData' | 'playerSpellHitsData' | 'castLedger';
  readonly spell: string;
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
  readonly refs: readonly string[];
}

export interface SpellCastLedgerAuditInputs {
  readonly specs: readonly {
    readonly spell: string;
    readonly manaCost: string;
    readonly durationTicks: string;
    readonly missiles: readonly string[];
  }[];
  readonly fizzleBranches: readonly {
    readonly spell: string;
    readonly setsSpellFizzled: boolean;
    readonly resource: 'free' | 'consumed';
    readonly refs: readonly string[];
  }[];
  readonly hitSources: readonly {
    readonly spell: string;
    readonly hitResult: string;
    readonly refs: readonly string[];
  }[];
}

const DEFAULT_AUDIT_INPUTS: SpellCastLedgerAuditInputs = {
  specs: SPELL_SPECS_DATA,
  fizzleBranches: SPELL_FIZZLE_BRANCHES_DATA,
  hitSources: PLAYER_SPELL_HIT_SOURCES_DATA,
};

const PhaseOrder: Readonly<Record<SpellCastPhase, number>> = {
  check: 0,
  add: 1,
  consume: 2,
  process: 3,
  end: 4,
};

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const sorted = (values: readonly string[]): string[] => unique(values).sort();
const show = (values: readonly string[]): string => values.length ? values.join(', ') : '(none)';

export const SPELL_CAST_LEDGERS: readonly SpellCastLedger[] = SPELL_CAST_LEDGER_DATA;

const BY_SPELL = new Map(SPELL_CAST_LEDGERS.map((ledger) => [ledger.spell, ledger]));

export function spellCastLedger(spell: string): SpellCastLedger | undefined {
  return BY_SPELL.get(spell);
}

export function allSpellCastLedgers(): readonly SpellCastLedger[] {
  return SPELL_CAST_LEDGERS;
}

function branchSignature(branch: { readonly setsSpellFizzled: boolean; readonly resource: string }): string {
  return `${branch.setsSpellFizzled}:${branch.resource}`;
}

/** Compare the ledger with the three older spell-law datasets without mutating any of them. */
export function auditSpellCastLedgers(
  ledgers: readonly SpellCastLedger[] = SPELL_CAST_LEDGERS,
  inputs: SpellCastLedgerAuditInputs = DEFAULT_AUDIT_INPUTS,
): SpellCastLedgerFinding[] {
  const findings: SpellCastLedgerFinding[] = [];
  const ledgerBySpell = new Map(ledgers.map((ledger) => [ledger.spell, ledger]));
  const specBySpell = new Map(inputs.specs.map((spec) => [spec.spell, spec]));

  for (const spec of inputs.specs) {
    const ledger = ledgerBySpell.get(spec.spell);
    if (!ledger) {
      findings.push({
        dataset: 'castLedger', spell: spec.spell, field: 'coverage',
        expected: 'one ordered ledger', actual: 'missing', refs: [],
      });
      continue;
    }
    if (ledger.manaCost.formula !== spec.manaCost) {
      findings.push({
        dataset: 'spellSpecsData', spell: spec.spell, field: 'manaCost',
        expected: ledger.manaCost.formula, actual: spec.manaCost,
        refs: unique([...ledger.manaCost.refs]),
      });
    }
    const ledgerMissiles = sorted([...ledger.initialMissiles, ...ledger.spawnedMissiles]);
    const specMissiles = sorted(spec.missiles);
    if (ledgerMissiles.join('\0') !== specMissiles.join('\0')) {
      findings.push({
        dataset: 'spellSpecsData', spell: spec.spell, field: 'missiles',
        expected: show(ledgerMissiles), actual: show(specMissiles), refs: ledger.refs,
      });
    }
    if (ledger.durationRule !== spec.durationTicks) {
      findings.push({
        dataset: 'spellSpecsData', spell: spec.spell, field: 'durationTicks',
        expected: ledger.durationRule, actual: spec.durationTicks, refs: ledger.refs,
      });
    }
    for (let index = 1; index < ledger.steps.length; index++) {
      if (PhaseOrder[ledger.steps[index].phase] < PhaseOrder[ledger.steps[index - 1].phase]) {
        findings.push({
          dataset: 'castLedger', spell: spec.spell, field: 'stepOrder',
          expected: 'check -> add -> consume -> process -> end',
          actual: ledger.steps.map((step) => step.phase).join(' -> '), refs: ledger.refs,
        });
        break;
      }
    }
  }

  for (const ledger of ledgers) {
    if (!specBySpell.has(ledger.spell)) {
      findings.push({
        dataset: 'castLedger', spell: ledger.spell, field: 'coverage',
        expected: 'a vanilla spellSpecsData row', actual: 'ledger has no matching spell law', refs: ledger.refs,
      });
    }
  }

  const fizzleSpells = unique([
    ...inputs.fizzleBranches.map((branch) => branch.spell),
    ...ledgers.flatMap((ledger) => ledger.steps.flatMap((step) =>
      (step.branches ?? []).filter((branch) => branch.sourceDataset === 'spellMechanicsData').map(() => ledger.spell))),
  ]);
  for (const spell of fizzleSpells) {
    const expected = inputs.fizzleBranches.filter((branch) => branch.spell === spell).map(branchSignature).sort();
    const actual = (ledgerBySpell.get(spell)?.steps ?? []).flatMap((step) => step.branches ?? [])
      .filter((branch): branch is SpellCastBranch & { setsSpellFizzled: boolean } =>
        branch.sourceDataset === 'spellMechanicsData' && branch.setsSpellFizzled !== undefined)
      .map(branchSignature).sort();
    if (expected.join('\0') !== actual.join('\0')) {
      findings.push({
        dataset: 'spellMechanicsData', spell, field: 'fizzleBranches',
        expected: show(actual), actual: show(expected),
        refs: inputs.fizzleBranches.filter((branch) => branch.spell === spell).flatMap((branch) => branch.refs),
      });
    }
  }

  for (const hitSource of inputs.hitSources) {
    const ledger = ledgerBySpell.get(hitSource.spell);
    const actual = ledger?.steps.find((step) => step.phase === 'process' && step.hitResult)?.hitResult;
    if (actual !== hitSource.hitResult) {
      findings.push({
        dataset: 'playerSpellHitsData', spell: hitSource.spell, field: 'hitResult',
        expected: actual ?? '(missing)', actual: hitSource.hitResult, refs: hitSource.refs,
      });
    }
  }

  return findings;
}

export const SPELL_CAST_LEDGER_FINDINGS: readonly SpellCastLedgerFinding[] = auditSpellCastLedgers();

/** Attach code-owned ledgers to promoted spell rows; raw source wrappers remain untouched. */
export function withSpellCastLedgers(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'spellbook' || wrapper.file !== 'spells/spelldat.tsv') return wrapper;
    const spell = wrapper.raw.id ?? wrapper.key;
    const castLedger = spellCastLedger(spell);
    if (!castLedger) return wrapper;
    return {
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: { ...wrapper.entity.data, castLedger },
      },
    };
  });
}

export { SPELL_CAST_LEDGER_DATA, SPELL_FIZZLE_RULE_DATA };
