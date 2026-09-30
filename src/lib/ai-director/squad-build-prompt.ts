// ── Squad build prompt ───────────────────────────────────────────────────────
// Turns the designer-authored DirectorConfig (SquadChoreographyEditor) into the
// prompt for the ai-behavior checklist item ai-5 ("Add group AI coordination").
//
// The ai-5 base text is kept verbatim: it owns the design (a squad manager that
// assigns roles, and melee slots as a RESERVATION ring owned by each target). The
// appended block only feeds it inputs — the tuned roles in allocation-priority
// order, each role's slot preferences, the scoring weights, and the EQS UPROPERTY
// defaults from eqs-defaults — so the generated C++ uses the declared numbers
// instead of inventing them. It deliberately names no class of its own (the editor's
// header preview emits a commander subsystem; that is not what ai-5 asks for).

import type { DirectorConfig, SquadConfigError, SquadRole } from '@/types/squad-tactics';
import { type Result, ok, err } from '@/types/result';
import { ROLE_DEFINITIONS, rolesByPriority, validateDirectorConfig } from '@/lib/ai-director/squad-engine';
import { formatComponentRef, eqsComponent, type EQSComponentId } from '@/lib/ai-director/eqs-catalog';
import {
  EQS_ATTACK_POSITIONS, EQS_COVER_POSITIONS, EQS_LINE_OF_SIGHT,
  eqsFloat, eqsClampMeta,
} from '@/lib/ai-director/eqs-defaults';

/** UPROPERTY defaults per custom EQS component, rendered the way the C++ source reads. */
const COMPONENT_DEFAULTS: Partial<Record<EQSComponentId, string>> = {
  'gen-attack-positions':
    `AttackDistance ${eqsFloat(EQS_ATTACK_POSITIONS.attackDistance)} (${eqsClampMeta(EQS_ATTACK_POSITIONS.clamps.attackDistance)}), ` +
    `NumberOfPoints ${EQS_ATTACK_POSITIONS.numberOfPoints} (${eqsClampMeta(EQS_ATTACK_POSITIONS.clamps.numberOfPoints)}), ` +
    `bGenerateInnerRing ${EQS_ATTACK_POSITIONS.generateInnerRing}`,
  'gen-cover-positions':
    `SampleCount ${EQS_COVER_POSITIONS.sampleCount} (${eqsClampMeta(EQS_COVER_POSITIONS.clamps.sampleCount)}), ` +
    `MinRadius ${eqsFloat(EQS_COVER_POSITIONS.minRadius)}, MaxRadius ${eqsFloat(EQS_COVER_POSITIONS.maxRadius)}, ` +
    `NumberOfRings ${EQS_COVER_POSITIONS.numberOfRings} (${eqsClampMeta(EQS_COVER_POSITIONS.clamps.numberOfRings)}), ` +
    `CoverCheckDistance ${eqsFloat(EQS_COVER_POSITIONS.coverCheckDistance)}`,
  'test-line-of-sight':
    `NumberOfTraceHeights ${EQS_LINE_OF_SIGHT.numberOfTraceHeights} (${eqsClampMeta(EQS_LINE_OF_SIGHT.clamps.numberOfTraceHeights)}), ` +
    `MinTraceHeight ${eqsFloat(EQS_LINE_OF_SIGHT.minTraceHeight)}, MaxTraceHeight ${eqsFloat(EQS_LINE_OF_SIGHT.maxTraceHeight)}`,
};

function roleCount(config: DirectorConfig, role: SquadRole): number {
  return config.formation.roles
    .filter((r) => r.role === role)
    .reduce((sum, r) => sum + Math.floor(r.count), 0);
}

/**
 * Build the ai-5 prompt for an authored squad. Returns the engine's typed
 * {@link SquadConfigError} when the config cannot be allocated (same validator the
 * editor's simulation runs, so a disabled Build button and this error agree).
 */
export function buildSquadBuildPrompt(
  config: DirectorConfig,
  ai5Prompt: string,
): Result<string, SquadConfigError> {
  const valid = validateDirectorConfig(config);
  if (!valid.ok) return err(valid.error);
  const c = valid.data;

  const roles = rolesByPriority(c.formation);
  const order = roles.map((r) => `${ROLE_DEFINITIONS[r].label} x${roleCount(c, r)}`).join(' → ');

  const roleLines = roles.map((r) => {
    const def = ROLE_DEFINITIONS[r];
    const [min, max] = def.engagementRange;
    const gens = def.generators.map(formatComponentRef).join(', ');
    const tests = def.tests.map(formatComponentRef).join(', ');
    return `- ${def.label} x${roleCount(c, r)}: preferred slot ${def.preferredFlankAngle}° from the target's forward (0° front, 180° behind), engagement range ${min}–${max} UU. EQS: ${gens}; tests ${tests}.`;
  });

  const used = new Set<EQSComponentId>();
  for (const r of roles) {
    for (const ref of [...ROLE_DEFINITIONS[r].generators, ...ROLE_DEFINITIONS[r].tests]) used.add(ref.component);
  }
  const defaultLines = [...used]
    .filter((id) => COMPONENT_DEFAULTS[id])
    .map((id) => `- ${eqsComponent(id).label} ${COMPONENT_DEFAULTS[id]}`);

  const block = [
    `## Designer-authored squad: ${c.formation.name} (${c.formation.size} members)`,
    `${c.formation.description}.`,
    'Use these values as the inputs to the role assignment and to the target-owned reservation ring described above. Do not introduce a separate commander or director class; the design above stays as written.',
    '',
    `Role assignment, in allocation-priority order: ${order}`,
    'Per-role slot preferences (the slot each role requests from the target-owned slot ring):',
    ...roleLines,
    '',
    `Director tuning: AttackDistance ${c.attackDistance} UU (slot ring radius), MinSeparation ${c.minSeparation} UU between squad members.`,
    `Slot scoring weights: FlankWeight ${c.flankWeight.toFixed(2)}, SeparationWeight ${c.separationWeight.toFixed(2)}, RangeWeight ${c.rangeWeight.toFixed(2)}.`,
    '',
    'EQS UPROPERTY defaults already declared in Source/PoF/AI/EQS/ (reuse these; do not invent new values):',
    ...defaultLines,
  ].join('\n');

  return ok(`${ai5Prompt}\n\n${block}`);
}
