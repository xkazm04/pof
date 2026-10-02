/**
 * UE damage execution, as shipped — the ONE home of what
 * `UARPGDamageExecution::Execute_Implementation` computes, its C++ snippets, and the
 * declared step table the Combat > Damage Pipeline panel renders.
 *
 * The shipped C++ predates canon (docs/catalog/ARPG-LAWS.md): it mitigates armour with the
 * RETIRED flat curve (read here only through `legacyArmorMitigation`, never re-spelled) and
 * rolls crit without the 95% cap. `compareWithCanon` runs the same inputs through the canon
 * kernel so the retired curve is never shown alone as the verdict.
 *
 * This mirrors the DOCUMENTED formula. In play AttackPower currently adds 0 — an open UE
 * defect (docs/superpowers/specs/2026-09-22-combat-attackpower-adds-zero.md); its "expected"
 * column is what `evaluateUeExecution` returns.
 */
import { legacyArmorMitigation } from '@/lib/ability/damage-formula';
import { armourReduction, computeHit } from '@/lib/combat/canon-kernel';

// ── Inputs / shipped result ──────────────────────────────────────────────────

export interface UeExecInputs {
  attackPower: number;
  critChance: number;
  critDamage: number;
  armor: number;
  baseDamage: number;
  scaling: number;
  /** The FMath::FRand() draw, pinned so the calculator is deterministic. */
  critRoll: number;
}

export const DEFAULT_UE_EXEC_INPUTS: UeExecInputs = {
  attackPower: 50, critChance: 0.25, critDamage: 1.5, armor: 30, baseDamage: 20, scaling: 1.0, critRoll: 0.5,
};

export interface UeExecResult {
  rawDamage: number;
  isCrit: boolean;
  critMultiplier: number;
  /** Fraction removed by the retired pre-canon armour curve. */
  armorReduction: number;
  finalDamage: number;
}

export function evaluateUeExecution(i: UeExecInputs): UeExecResult {
  const rawDamage = i.baseDamage + i.attackPower * i.scaling;
  const isCrit = i.critRoll < i.critChance;
  const critMultiplier = isCrit ? 1 + i.critDamage : 1;
  const armorReduction = legacyArmorMitigation(i.armor);
  const finalDamage = Math.max(rawDamage * critMultiplier * (1 - armorReduction), 0);
  return { rawDamage, isCrit, critMultiplier, armorReduction, finalDamage };
}

// ── Canon twin ───────────────────────────────────────────────────────────────

export type ExecDivergence = 'armour-curve' | 'crit-cap';

export interface CanonComparison {
  shipped: UeExecResult;
  canon: { total: number; isCrit: boolean };
  /** canon − shipped. */
  delta: number;
  /** delta as a percent of shipped (0 when shipped is 0). */
  deltaPct: number;
  /** Which canon laws the shipped execution breaks for these inputs. */
  divergences: ExecDivergence[];
}

/** Same inputs through the canon kernel: one Physical bucket, crit ×(1 + CriticalDamage), rng = the pinned roll. */
export function compareWithCanon(i: UeExecInputs): CanonComparison {
  const shipped = evaluateUeExecution(i);
  const hit = computeHit(
    {
      buckets: { Physical: { base: shipped.rawDamage } },
      crit: { chance: i.critChance, multiplier: 1 + i.critDamage },
    },
    { armour: i.armor },
    { rng: () => i.critRoll },
  );
  const delta = hit.total - shipped.finalDamage;
  const divergences: ExecDivergence[] = [];
  if (shipped.isCrit !== hit.isCrit) divergences.push('crit-cap');
  // Canon soft-caps armour against the (post-crit) hit; the retired curve ignores hit size.
  const canonArmour = armourReduction(i.armor, shipped.rawDamage * (hit.isCrit ? 1 + i.critDamage : 1));
  if (Math.abs(canonArmour - shipped.armorReduction) > 1e-9) divergences.push('armour-curve');
  return {
    shipped,
    canon: { total: hit.total, isCrit: hit.isCrit },
    delta,
    deltaPct: shipped.finalDamage > 0 ? (delta / shipped.finalDamage) * 100 : 0,
    divergences,
  };
}

// ── C++ snippets (as shipped) ────────────────────────────────────────────────

export const EXEC_SNIPPETS = {
  invuln: `const UAbilitySystemComponent* TargetASC = ExecutionParams.GetTargetAbilitySystemComponent();
if (TargetASC && TargetASC->HasMatchingGameplayTag(ARPGGameplayTags::State_Invulnerable))
{
    return; // Skip all damage
}`,
  ap: `float AttackPower = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().AttackPowerDef, FAggregatorEvaluateParameters(), AttackPower);`,
  cc: `float CriticalChance = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().CriticalChanceDef, FAggregatorEvaluateParameters(), CriticalChance);`,
  cd: `float CriticalDamage = 1.5f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().CriticalDamageDef, FAggregatorEvaluateParameters(), CriticalDamage);`,
  armor: `float Armor = 0.f;
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(
    DamageStatics().ArmorDef, FAggregatorEvaluateParameters(), Armor);`,
  base: `const float BaseDamage = Spec.GetSetByCallerMagnitude(
    ARPGGameplayTags::Data_Damage_Base, /*WarnIfNotFound=*/ true, /*DefaultIfNotFound=*/ 0.f);`,
  scaling: `const float Scaling = Spec.GetSetByCallerMagnitude(
    ARPGGameplayTags::Data_Damage_Scaling, /*WarnIfNotFound=*/ false, /*DefaultIfNotFound=*/ 1.f);`,
  raw: 'const float RawDamage = BaseDamage + AttackPower * Scaling;',
  crit: `const bool bIsCrit = FMath::FRand() < CriticalChance;
const float CritMultiplier = bIsCrit ? (1.f + CriticalDamage) : 1.f;`,
  ar: 'const float ArmorReduction = Armor / (Armor + 100.f);',
  final: `float FinalDamage = RawDamage * CritMultiplier * (1.f - ArmorReduction);
FinalDamage = FMath::Max(FinalDamage, 0.f);`,
  outcrit: `OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(
    UARPGAttributeSet::GetIncomingCritAttribute(),
    EGameplayModOp::Override,
    bIsCrit ? 1.f : 0.f));`,
  outdmg: `OutExecutionOutput.AddOutputModifier(FGameplayModifierEvaluatedData(
    UARPGAttributeSet::GetIncomingDamageAttribute(),
    EGameplayModOp::Additive,
    FinalDamage));`,
} as const;

// ── Declared step table ──────────────────────────────────────────────────────

export type UeExecStepId = keyof typeof EXEC_SNIPPETS;
export type UeExecPhase = 'invuln' | 'capture' | 'setbycaller' | 'formula' | 'output';

export const UE_EXEC_PHASE_LABELS: Record<UeExecPhase, string> = {
  invuln: 'Invulnerability Check',
  capture: '1. Attribute Capture',
  setbycaller: '2. SetByCaller Resolution',
  formula: '3. Damage Formula',
  output: '4. Meta Attribute Output',
};

export interface UeExecStepCtx { inputs: UeExecInputs; result: UeExecResult }

export interface UeExecStep {
  id: UeExecStepId;
  phase: UeExecPhase;
  label: string;
  snippet: string;
  /** The calculator input this row edits. */
  input?: { key: keyof UeExecInputs; label: string; step: number; min?: number; max?: number };
  note?: string;
  /** Worked arithmetic, shown while the calculator is on. */
  expr?: (c: UeExecStepCtx) => string;
  value: (c: UeExecStepCtx) => string;
  /** How the value reads: a computed result, the retired curve, the final hit, a crit flag. */
  tone?: 'result' | 'retired' | 'final' | 'crit';
  modOp?: 'Override' | 'Additive';
}

export const fmtExec = (v: number, dec = 2) => v.toFixed(dec);
const f = fmtExec;

function step(id: UeExecStepId, phase: UeExecPhase, label: string, rest: Omit<UeExecStep, 'id' | 'phase' | 'label' | 'snippet'>): UeExecStep {
  return { id, phase, label, snippet: EXEC_SNIPPETS[id], ...rest };
}

const showInput = (key: keyof UeExecInputs) => ({ inputs }: UeExecStepCtx) => f(inputs[key]);

export const UE_EXECUTION_STEPS: readonly UeExecStep[] = [
  step('invuln', 'invuln', 'State_Invulnerable', { value: () => '→ skip all damage' }),
  step('ap', 'capture', 'Source > AttackPower', { input: { key: 'attackPower', label: 'AttackPower', step: 5, min: 0 }, value: showInput('attackPower') }),
  step('cc', 'capture', 'Source > CriticalChance', { input: { key: 'critChance', label: 'CriticalChance', step: 0.05, min: 0, max: 1 }, value: showInput('critChance') }),
  step('cd', 'capture', 'Source > CriticalDamage', { input: { key: 'critDamage', label: 'CriticalDamage', step: 0.1, min: 0 }, value: showInput('critDamage') }),
  step('armor', 'capture', 'Target > Armor', { input: { key: 'armor', label: 'Armor', step: 5, min: 0 }, value: showInput('armor') }),
  step('base', 'setbycaller', 'Data.Damage.Base', { input: { key: 'baseDamage', label: 'BaseDamage', step: 5, min: 0 }, note: '(required)', value: showInput('baseDamage') }),
  step('scaling', 'setbycaller', 'Data.Damage.Scaling', { input: { key: 'scaling', label: 'Scaling', step: 0.1, min: 0 }, note: '(default 1.0)', value: showInput('scaling') }),
  step('raw', 'formula', 'Step 1 > RawDamage', {
    expr: ({ inputs: i }) => `${f(i.baseDamage)} + ${f(i.attackPower)} x ${f(i.scaling)} =`,
    value: ({ result }) => f(result.rawDamage), tone: 'result',
  }),
  step('crit', 'formula', 'Step 2 > CritRoll', {
    input: { key: 'critRoll', label: 'CritRoll', step: 0.05, min: 0, max: 1 },
    expr: ({ inputs: i, result }) => `< ${f(i.critChance)} ${result.isCrit ? 'CRIT' : 'miss'} (no 95% cap)`,
    value: ({ result }) => `x${f(result.critMultiplier)}`, tone: 'result',
  }),
  step('ar', 'formula', 'Step 3 > ArmorReduction', {
    note: 'retired pre-canon curve',
    expr: ({ inputs: i }) => `legacyArmorMitigation(${f(i.armor)}) =`,
    value: ({ result }) => `${(result.armorReduction * 100).toFixed(1)}% reduced`, tone: 'retired',
  }),
  step('final', 'formula', 'Step 4 > FinalDamage', {
    expr: ({ result: r }) => `${f(r.rawDamage)} x ${f(r.critMultiplier)} x ${(1 - r.armorReduction).toFixed(3)} =`,
    value: ({ result }) => f(result.finalDamage), tone: 'final',
  }),
  step('outcrit', 'output', 'IncomingCrit', {
    modOp: 'Override', value: ({ result }) => (result.isCrit ? '1.0 (crit)' : '0.0 (no crit)'), tone: 'crit',
  }),
  step('outdmg', 'output', 'IncomingDamage', { modOp: 'Additive', value: ({ result }) => f(result.finalDamage), tone: 'final' }),
];
