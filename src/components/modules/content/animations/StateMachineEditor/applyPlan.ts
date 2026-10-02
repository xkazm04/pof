/**
 * Apply-to-AnimInstance: the seed-relative change plan the operator approves
 * before the CLI writes anything to the project.
 *
 * The editor's provenance strip says "edits below are yours, not the project's
 * until you apply them". This module is the honest half of that promise:
 *
 * - `buildApplyPlan` compares the canvas with the machine it was SEEDED from
 *   (not a manual snapshot) and names every change by state name — the
 *   disclosure the operator consents to. It refuses (status `blocked`, with
 *   reasons) when there is nothing real to write to: a template canvas, a seed
 *   that names no AnimInstance header (the live bridge), or an error-severity
 *   lint finding that would ship uncompilable C++.
 * - `buildApplyPrompt` renders that plan as ONE CLI instruction aimed at the
 *   scanned class and header — never the template's `UARPGAnimInstance`.
 *
 * Pure: no React, no I/O. The write itself goes through the module's CLI rail
 * (`useModuleCLI` + `TaskFactory.quickAction`, see EditorTab), never a direct
 * file write from the app.
 */

import { compileMachine } from '@/lib/state-machine-compile';
import type { ValidationWarning } from '@/lib/state-machine-validator';
import type { EditorSeed, SeedTarget } from './seed';
import type { EditorState, EditorTransition } from './types';

export type ApplyStatus = 'blocked' | 'no-changes' | 'ready';

export type ApplyChangeKind =
  | 'state-added'
  | 'state-removed'
  | 'state-renamed'
  | 'priority-changed'
  | 'flag-changed'
  | 'default-changed'
  | 'transition-added'
  | 'transition-removed'
  | 'rule-changed';

export interface ApplyChange {
  kind: ApplyChangeKind;
  /** Human sentence naming states by NAME (never an editor id). */
  label: string;
}

export interface ApplyPlan {
  status: ApplyStatus;
  /** Why the plan is blocked (empty unless status is 'blocked'). */
  reasons: string[];
  /** Canvas vs seed, in KIND_ORDER. */
  changes: ApplyChange[];
  target: SeedTarget | null;
  /** The seed's origin sentence — what the changes are relative to. */
  origin: string | null;
  states: EditorState[];
  transitions: EditorTransition[];
}

export interface ApplyPlanInput {
  seed: EditorSeed | null;
  states: EditorState[];
  transitions: EditorTransition[];
  warnings: readonly ValidationWarning[];
}

const KIND_ORDER: readonly ApplyChangeKind[] = [
  'state-added', 'state-removed', 'state-renamed', 'priority-changed', 'flag-changed', 'default-changed',
  'transition-added', 'transition-removed', 'rule-changed',
];

const ruleText = (rule: string | undefined) => (rule ?? '').trim();
const describeRule = (rule: string) => (rule ? `when "${rule}"` : '(no rule)');

/**
 * Pair each canvas state with the seed state it came from: by id first (a
 * rename keeps the id), then by name (a re-scan after a rename issues a new
 * `scanned-<name>` id for the same state).
 */
function pairStates(seed: EditorSeed, states: EditorState[]): Map<string, EditorState> {
  const seedById = new Map(seed.states.map((s) => [s.id, s]));
  const pairs = new Map<string, EditorState>();
  const used = new Set<string>();
  for (const s of states) {
    const match = seedById.get(s.id);
    if (match) { pairs.set(s.id, match); used.add(match.id); }
  }
  const freeByName = new Map(seed.states.filter((s) => !used.has(s.id)).map((s) => [s.name, s]));
  for (const s of states) {
    if (pairs.has(s.id)) continue;
    const match = freeByName.get(s.name);
    if (match) { pairs.set(s.id, match); freeByName.delete(s.name); }
  }
  return pairs;
}

/** Canvas vs seed, keyed by state identity and reported by state NAME. */
export function diffAgainstSeed(
  seed: EditorSeed,
  states: EditorState[],
  transitions: EditorTransition[],
): ApplyChange[] {
  const changes: ApplyChange[] = [];
  const pairs = pairStates(seed, states);
  const pairedSeedIds = new Set([...pairs.values()].map((s) => s.id));

  for (const s of states) {
    const was = pairs.get(s.id);
    if (!was) {
      changes.push({ kind: 'state-added', label: `Added state ${s.name} (priority ${s.priority}, flag ${s.flag || 'none'})` });
      continue;
    }
    if (was.name !== s.name) changes.push({ kind: 'state-renamed', label: `Renamed state ${was.name} → ${s.name}` });
    if (was.priority !== s.priority) changes.push({ kind: 'priority-changed', label: `${s.name} priority ${was.priority} → ${s.priority}` });
    if (was.flag !== s.flag) changes.push({ kind: 'flag-changed', label: `${s.name} flag ${was.flag || 'none'} → ${s.flag || 'none'}` });
    if (!!was.isDefault !== !!s.isDefault) {
      changes.push({ kind: 'default-changed', label: s.isDefault ? `${s.name} is now the Default (fallback) state` : `${s.name} is no longer the Default state` });
    }
  }
  for (const s of seed.states) {
    if (!pairedSeedIds.has(s.id)) changes.push({ kind: 'state-removed', label: `Removed state ${s.name}` });
  }

  // Transitions are keyed by the SEED identity of their endpoints, so a renamed
  // endpoint is one rename, not a removed + added transition.
  const seedName = new Map(seed.states.map((s) => [s.id, s.name]));
  const canvasName = new Map(states.map((s) => [s.id, s.name]));
  const canvasKey = (id: string) => pairs.get(id)?.id ?? `new:${id}`;
  const before = new Map(seed.transitions.map((t) => [`${t.from}>${t.to}`, t]));
  const after = new Map(transitions.map((t) => [`${canvasKey(t.from)}>${canvasKey(t.to)}`, t]));
  for (const [key, t] of after) {
    const name = `${canvasName.get(t.from) ?? '?'} → ${canvasName.get(t.to) ?? '?'}`;
    const was = before.get(key);
    if (!was) changes.push({ kind: 'transition-added', label: `Added transition ${name} ${describeRule(ruleText(t.rule))}` });
    else if (ruleText(was.rule) !== ruleText(t.rule)) {
      changes.push({ kind: 'rule-changed', label: `Transition ${name} rule "${ruleText(was.rule)}" → "${ruleText(t.rule)}"` });
    }
  }
  for (const [key, t] of before) {
    if (!after.has(key)) {
      changes.push({ kind: 'transition-removed', label: `Removed transition ${seedName.get(t.from) ?? '?'} → ${seedName.get(t.to) ?? '?'}` });
    }
  }

  return changes.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function buildApplyPlan({ seed, states, transitions, warnings }: ApplyPlanInput): ApplyPlan {
  const base = { target: seed?.target ?? null, origin: seed?.origin ?? null, states, transitions };
  if (!seed) {
    return {
      ...base, status: 'blocked', changes: [],
      reasons: ['The canvas is a template with no project target — scan an AnimBP to edit (and apply to) the real machine.'],
    };
  }
  const changes = diffAgainstSeed(seed, states, transitions);
  if (!seed.target) {
    const reason = seed.source === 'bridge'
      ? 'Seeded from the live UE bridge, which names no AnimInstance header to write to — run Scan AnimBP to target the C++ class (while the bridge is connected its seed takes precedence over a scan).'
      : 'The AnimBP scan found no AnimInstance header to write to — check the project source and run Scan AnimBP again.';
    return { ...base, status: 'blocked', changes, reasons: [reason] };
  }
  if (changes.length === 0) return { ...base, status: 'no-changes', changes, reasons: [] };
  const errors = warnings.filter((w) => w.severity === 'error').map((w) => w.message);
  if (errors.length > 0) return { ...base, status: 'blocked', changes, reasons: errors };
  return { ...base, status: 'ready', changes, reasons: [] };
}

/** One CLI instruction: the target, the named changes, and the resulting machine. */
export function buildApplyPrompt(plan: ApplyPlan): string {
  const target = plan.target;
  if (!target) return '';
  const cls = target.className;
  const compiled = compileMachine(plan.states, plan.transitions);
  const nameOf = new Map(plan.states.map((s) => [s.id, s.name]));
  const cascade = compiled.cascade.map((s, i) => `${i + 1}. if (${s.flag}) → ${s.name}`);
  const rules = plan.transitions.map((t) =>
    `- ${nameOf.get(t.from) ?? '?'} → ${nameOf.get(t.to) ?? '?'}: ${ruleText(t.rule) || '(no rule)'}`);

  return [
    `Apply the visual state-machine edits below to the project's AnimInstance, ${cls}.`,
    '',
    '## Target',
    `- Class: ${cls}`,
    `- Header: ${target.headerPath} (relative to Source/) and its matching .cpp`,
    `- Function: ${cls}::ComputeAnimState() and the state enum / bool flags it reads`,
    '',
    `## Changes vs ${plan.origin ?? cls} — apply exactly these, nothing else`,
    ...plan.changes.map((c, i) => `${i + 1}. ${c.label}`),
    '',
    '## Resulting priority cascade (ComputeAnimState checks top to bottom)',
    ...cascade,
    `Fallback (no flag set): ${compiled.fallback?.name ?? '(none)'}`,
    '',
    '## Resulting transition rules',
    ...(rules.length > 0 ? rules : ['- (none)']),
    '',
    '## Rules',
    `- Keep ${cls}'s existing state enum type and naming conventions; rename, add or remove its enumerators to match the changes.`,
    '- Declare any new bool flag on the class as a UPROPERTY(BlueprintReadOnly), defaulting to false.',
    '- Change only what the list above names; leave unrelated code untouched.',
    '- Build with the project build command and fix any compile error you introduced.',
    '- Do NOT use TodoWrite.',
  ].join('\n');
}
