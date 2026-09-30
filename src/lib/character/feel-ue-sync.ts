/**
 * Feel vs UE — reconcile the resolved feel stack against the literal defaults the
 * UE project's character sources actually declare.
 *
 * Pure (client + server): the route hands in `{ path, text }` files; nothing here
 * touches the filesystem. Only numeric literals count as a value. A runtime
 * assignment (`FMath::FInterpTo(...)`, `= WalkSpeed`) is a *runtime writer*: listed,
 * never a value, and it only makes a field `unparsed` when no literal exists.
 */

import { fieldLabel, type AdjustmentLayer, type LayerModifier } from '@/lib/feel-adjustment-layers';
import { getNestedValue, type FeelProfile } from '@/lib/character-feel-optimizer';

/* ── Binding table: feel field → ordered UE identifiers ─────────────────────── */

export type BindingKind = 'scalar' | 'rotator-yaw' | 'vector-z';

export interface FeelUEBinding {
  field: string;
  /** UE identifiers, canonical first then live aliases. */
  names: readonly string[];
  kind: BindingKind;
}

const b = (field: string, names: string[], kind: BindingKind = 'scalar'): FeelUEBinding => ({ field, names, kind });

export const FEEL_UE_BINDINGS: readonly FeelUEBinding[] = [
  b('movement.maxWalkSpeed', ['MaxWalkSpeed', 'WalkSpeed']),
  b('movement.maxSprintSpeed', ['MaxSprintSpeed', 'SprintSpeed']),
  b('movement.acceleration', ['MaxAcceleration']),
  b('movement.deceleration', ['BrakingDecelerationWalking']),
  b('movement.turnRate', ['RotationRate'], 'rotator-yaw'),
  b('movement.airControl', ['AirControl']),
  b('movement.jumpZVelocity', ['JumpZVelocity']),
  b('movement.gravityScale', ['GravityScale']),
  b('combat.baseDamage', ['BaseDamage']),
  b('combat.attackSpeed', ['AttackSpeed']),
  b('combat.comboWindowMs', ['ComboWindowMs']),
  b('combat.hitReactionDuration', ['HitReactionDuration']),
  b('combat.critChance', ['CritChance']),
  b('combat.critMultiplier', ['CritMultiplier']),
  b('combat.attackRange', ['AttackRange']),
  b('combat.cleaveAngle', ['CleaveAngle']),
  b('dodge.distance', ['DodgeDistance']),
  b('dodge.duration', ['DodgeDuration']),
  b('dodge.iFrameStart', ['IFrameStart']),
  b('dodge.iFrameDuration', ['IFrameDuration', 'DodgeInvulnerabilityDuration']),
  b('dodge.cooldown', ['DodgeCooldown']),
  b('dodge.staminaCost', ['DodgeStaminaCost']),
  b('dodge.cancelWindowStart', ['DodgeCancelWindowStart']),
  b('dodge.cancelWindowEnd', ['DodgeCancelWindowEnd']),
  b('camera.armLength', ['TargetArmLength', 'BaseArmLength']),
  b('camera.lagSpeed', ['CameraLagSpeed']),
  b('camera.fovBase', ['FieldOfView', 'BaseFOV']),
  b('camera.fovSprintOffset', ['SprintFOVOffset', 'SprintFOVBonus']),
  b('camera.swayMaxRoll', ['SwayMaxRoll']),
  b('camera.swayMaxPitch', ['SwayMaxPitch']),
  b('camera.swayInterpSpeed', ['SwayInterpSpeed']),
  b('camera.socketOffsetZ', ['SocketOffset'], 'vector-z'),
  b('staminaDrainPerSec', ['StaminaDrainPerSec', 'StaminaDrainRate']),
  b('staminaRegenPerSec', ['StaminaRegenPerSec', 'StaminaRegenRate']),
];

/* ── Parse ──────────────────────────────────────────────────────────────────── */

export interface UESourceFile { path: string; text: string }

export interface UESite {
  name: string;
  path: string;
  line: number;
  /** Literal value (literal sites only). */
  value?: number;
  /** Right-hand side as written (runtime writers only). */
  expr?: string;
}

export type ParseStatus = 'found' | 'unparsed' | 'ambiguous' | 'absent';

export interface ParsedFeelField {
  field: string;
  status: ParseStatus;
  /** The agreed literal value — null unless `found`. */
  value: number | null;
  /** Primary site: first literal site, else first runtime writer. */
  name: string | null;
  path: string | null;
  line: number | null;
  sites: UESite[];
  runtimeWriters: UESite[];
}

export type ParsedFeelDefaults = Record<string, ParsedFeelField>;

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fF]?`;
const LITERAL = new RegExp(`^${NUM}$`);
const ARGS3 = new RegExp(`^F(?:Rotator|Vector)\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)$`);

const toNumber = (lit: string): number => Number(lit.replace(/[fF]$/, ''));

/** Literal value of an RHS for this binding kind, or null when it is a runtime expression. */
function literalOf(rhs: string, kind: BindingKind): number | null {
  if (kind === 'scalar') return LITERAL.test(rhs) ? toNumber(rhs) : null;
  const m = ARGS3.exec(rhs);
  if (!m) return null;
  return toNumber(kind === 'rotator-yaw' ? m[2] : m[3]);
}

const assignRe = (name: string) => new RegExp(`(?<!\\w)${name}\\s*=(?!=)\\s*([^;]+);`);

/** Read header initialisers and constructor assignments for every bound field. */
export function parseFeelDefaults(files: readonly UESourceFile[]): ParsedFeelDefaults {
  const out: ParsedFeelDefaults = {};
  for (const bind of FEEL_UE_BINDINGS) {
    const sites: UESite[] = [];
    const runtimeWriters: UESite[] = [];
    const patterns = bind.names.map((name) => [name, assignRe(name)] as const);
    for (const file of files) {
      file.text.split(/\r?\n/).forEach((raw, i) => {
        const code = raw.replace(/\/\/.*$/, '');
        for (const [name, re] of patterns) {
          const m = re.exec(code);
          if (!m) continue;
          const rhs = m[1].trim();
          const value = literalOf(rhs, bind.kind);
          const site = { name, path: file.path, line: i + 1 };
          if (value === null) runtimeWriters.push({ ...site, expr: rhs });
          else sites.push({ ...site, value });
        }
      });
    }
    const distinct = new Set(sites.map((s) => s.value));
    const status: ParseStatus = sites.length > 0
      ? (distinct.size === 1 ? 'found' : 'ambiguous')
      : runtimeWriters.length > 0 ? 'unparsed' : 'absent';
    const primary = sites[0] ?? runtimeWriters[0] ?? null;
    out[bind.field] = {
      field: bind.field,
      status,
      value: status === 'found' ? sites[0].value! : null,
      name: primary?.name ?? null,
      path: primary?.path ?? null,
      line: primary?.line ?? null,
      sites,
      runtimeWriters,
    };
  }
  return out;
}

/* ── Diff ───────────────────────────────────────────────────────────────────── */

export type DriftStatus = 'in-sync' | 'drift' | 'absent' | 'unparsed' | 'ambiguous';

export interface DriftRow {
  field: string;
  label: string;
  names: readonly string[];
  status: DriftStatus;
  stackValue: number;
  ueValue: number | null;
  sites: UESite[];
  runtimeWriters: UESite[];
}

export interface DriftSummary { inSync: number; drift: number; absent: number; unparsed: number; ambiguous: number }

/** Literal float noise (`0.2f`, `352.00000000000006`) never reads as drift. */
function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** One row per bound field; a field the parse map lacks is `absent`. */
export function diffAgainstUE(resolved: FeelProfile, parsed: ParsedFeelDefaults): { rows: DriftRow[]; summary: DriftSummary } {
  const summary: DriftSummary = { inSync: 0, drift: 0, absent: 0, unparsed: 0, ambiguous: 0 };
  const rows = FEEL_UE_BINDINGS.map((bind): DriftRow => {
    const p = parsed[bind.field];
    const stackValue = getNestedValue(resolved, bind.field);
    const status: DriftStatus = !p || p.status === 'absent' ? 'absent'
      : p.status === 'found' ? (sameValue(p.value!, stackValue) ? 'in-sync' : 'drift')
      : p.status;
    summary[status === 'in-sync' ? 'inSync' : status] += 1;
    return {
      field: bind.field, label: fieldLabel(bind.field), names: bind.names, status, stackValue,
      ueValue: p?.status === 'found' ? p.value : null,
      sites: p?.sites ?? [], runtimeWriters: p?.runtimeWriters ?? [],
    };
  });
  return { rows, summary };
}

/* ── Apply only the drift ───────────────────────────────────────────────────── */

const loc = (s: UESite) => `${s.path}:${s.line}`;
/** Stack values can carry float noise from pct layers (352.00000000000006). */
const fmt = (n: number) => Number(n.toFixed(4));

function driftLines(row: DriftRow): string[] {
  const kindHint = FEEL_UE_BINDINGS.find((x) => x.field === row.field)?.kind;
  const suffix = kindHint === 'rotator-yaw' ? ' (FRotator yaw)' : kindHint === 'vector-z' ? ' (FVector Z)' : '';
  const lines = row.sites.map((s) => `- ${s.name} (${loc(s)}): ${s.value} -> ${fmt(row.stackValue)}${suffix}`);
  if (row.runtimeWriters.length > 0) {
    lines.push(`  - runtime writers, leave as-is: ${row.runtimeWriters.map(loc).join(', ')}`);
  }
  return lines;
}

/**
 * The CLI prompt for applying only what differs. Drift rows name the located
 * identifier and line; absent rows are reported, never created. Returns null when
 * nothing drifts and nothing is absent (Apply disabled — in sync with UE).
 */
export function buildDriftApplyPrompt(rows: readonly DriftRow[]): string | null {
  const drift = rows.filter((r) => r.status === 'drift');
  const absent = rows.filter((r) => r.status === 'absent');
  if (drift.length === 0 && absent.length === 0) return null;

  const sections = [`## Task: Apply feel drift to the UE project (${drift.length} drifted, ${absent.length} not declared)`,
    'PoF read the literal defaults in the character sources and compared them with the resolved feel stack. Edit ONLY what is listed.'];
  if (drift.length > 0) {
    sections.push(`### Drifted literals — change each value in place (identifier (file:line): UE -> stack)\n${drift.flatMap(driftLines).join('\n')}`);
  }
  if (absent.length > 0) {
    sections.push(`### Not declared in the scanned sources — report, do not create
${absent.map((r) => `- ${r.label}: ${r.names.join(' / ')} (stack value ${fmt(r.stackValue)})`).join('\n')}
For each, search Source/ for a declaration under any name. Do not create a new UPROPERTY: list each one in your summary as "declared at <file:line>" or "not declared".`);
  }
  sections.push(`### Instructions
1. Edit only the literal at each listed file:line; keep the identifier, type and UPROPERTY specifiers.
2. Leave runtime writers (FInterpTo, assignments from other variables) untouched.
3. Verify the code compiles.`);
  return sections.join('\n\n');
}

/* ── Adopt UE values into the stack ─────────────────────────────────────────── */

export const UE_ADOPTED_LAYER_ID = 'ue-adopted';
export const UE_ADOPTED_LAYER_NAME = 'Adopted from UE';

/**
 * The reserved 'ue-adopted' `set` layer carrying the UE value for each requested
 * field that has one. `existing` modifiers for other fields are kept. Null when no
 * requested field has a UE value.
 */
export function buildAdoptLayer(
  rows: readonly DriftRow[],
  fields: readonly string[],
  existing?: AdjustmentLayer,
): AdjustmentLayer | null {
  const adopted: LayerModifier[] = rows
    .filter((r) => fields.includes(r.field) && r.ueValue !== null)
    .map((r) => ({ field: r.field, op: 'set' as const, value: r.ueValue! }));
  if (adopted.length === 0) return null;
  const kept = (existing?.modifiers ?? []).filter((m) => !adopted.some((a) => a.field === m.field));
  return {
    ...(existing ?? {}),
    id: UE_ADOPTED_LAYER_ID,
    name: existing?.name ?? UE_ADOPTED_LAYER_NAME,
    enabled: true,
    modifiers: [...kept, ...adopted],
  };
}
