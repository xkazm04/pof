/**
 * Seeding the visual editor from what the PROJECT actually has.
 *
 * The editor used to open on `DEFAULT_STATES` — five invented locomotion
 * states — regardless of what the AnimBP scan or the live bridge had already
 * found. That makes every generated `ComputeAnimState()` a fiction about a
 * different project. These builders convert the read-only graph's two real
 * sources into editable states/transitions, and each carries the `source` and
 * `origin` the UI must state, so a template can never pass itself off as the
 * project's own machine.
 *
 * Layout + classification are reused from the read-only graph's helpers
 * (`AnimationStateMachine/helpers`) — no second graph-layout implementation.
 */

import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';
import { layoutStates, classifyState } from '../AnimationStateMachine/helpers';
import type { EditorState, EditorTransition } from './types';

export type SeedSource = 'scan' | 'bridge' | 'template';

export interface EditorSeed {
  states: EditorState[];
  transitions: EditorTransition[];
  /** Which real source produced these states. */
  source: Exclude<SeedSource, 'template'>;
  /** Human sentence naming that source (class name, asset count, timestamp). */
  origin: string;
}

/**
 * Identity of a seed by CONTENT, not by object reference. A caller that rebuilds
 * its seed each render (the common case — `seedFromScan(scanResult)` inline)
 * must not look like a new seed every time, or the editor would re-adopt it in
 * a render loop.
 */
export function seedSignature(seed: EditorSeed | null): string | null {
  if (!seed) return null;
  return [
    seed.source,
    seed.origin,
    seed.states.map((s) => `${s.id}:${s.name}`).join(','),
    seed.transitions.map((t) => `${t.from}>${t.to}:${t.rule}`).join(','),
  ].join('|');
}

/** A state's editor id, derived from the graph's `scanned-<name>` convention. */
function editorStateId(name: string): string {
  return `scanned-${name}`;
}

/**
 * A UE `bIs<State>` flag guess for a scanned state. The scan reports names, not
 * AnimInstance booleans, so the flag is a starting point the operator edits —
 * the linter flags it when it is not a known flag, which is the honest signal.
 */
function flagForState(name: string): string {
  return `bIs${name.replace(/[^A-Za-z0-9]/g, '')}`;
}

function toEditorStates(
  raw: { name: string; hasMontage: boolean; montageRef?: string | null }[],
): EditorState[] {
  const laid = layoutStates(raw.map((s) => ({ name: s.name, hasMontage: s.hasMontage })));
  const byId = new Map(laid.map((n) => [n.id, n]));
  return raw.map((s, i) => {
    const node = byId.get(editorStateId(s.name));
    return {
      id: editorStateId(s.name),
      name: s.name,
      stateType: classifyState(s.name, s.hasMontage),
      priority: i,
      flag: flagForState(s.name),
      x: node?.x ?? 50,
      y: node?.y ?? 50,
      montageRef: s.montageRef ?? undefined,
    };
  });
}

function toEditorTransitions(
  raw: { from: string; to: string; rule: string | null }[],
  known: Set<string>,
): EditorTransition[] {
  const out: EditorTransition[] = [];
  for (const t of raw) {
    const from = editorStateId(t.from);
    const to = editorStateId(t.to);
    // A transition whose endpoints are not both real states would render as a
    // dangling edge; drop it rather than invent a node for it.
    if (!known.has(from) || !known.has(to)) continue;
    out.push({ id: `seed-${t.from}->${t.to}`, from, to, rule: t.rule ?? '' });
  }
  return out;
}

/** Build a seed from an AnimBP source scan, or null when it found no states. */
export function seedFromScan(scan: AnimBPScanResult | null | undefined): EditorSeed | null {
  if (!scan || !Array.isArray(scan.states) || scan.states.length === 0) return null;
  const states = toEditorStates(scan.states);
  const known = new Set(states.map((s) => s.id));
  return {
    states,
    transitions: toEditorTransitions(scan.transitions ?? [], known),
    source: 'scan',
    origin: `${scan.animInstanceClass ?? 'your AnimInstance'}${scan.headerPath ? ` (${scan.headerPath})` : ''}`,
  };
}

/** The bridge manifest's state-machine shape, as `useManifest` reports it. */
export interface BridgeStateMachine {
  states: string[];
  transitions: { from: string; to: string; condition: string }[];
}

/**
 * Build a seed from the live bridge manifest's AnimBlueprint state machines.
 * The bridge conveys no per-state montage information, so `hasMontage` is false
 * for every state — the same limitation the read-only graph documents.
 */
export function seedFromBridge(
  machines: BridgeStateMachine[] | null | undefined,
  assetName?: string,
): EditorSeed | null {
  if (!machines || machines.length === 0) return null;
  const names: string[] = [];
  const raw: { from: string; to: string; rule: string | null }[] = [];
  for (const sm of machines) {
    for (const s of sm.states) if (!names.includes(s)) names.push(s);
    for (const t of sm.transitions) raw.push({ from: t.from, to: t.to, rule: t.condition || null });
  }
  if (names.length === 0) return null;
  const states = toEditorStates(names.map((name) => ({ name, hasMontage: false })));
  const known = new Set(states.map((s) => s.id));
  return {
    states,
    transitions: toEditorTransitions(raw, known),
    source: 'bridge',
    origin: `the live UE bridge${assetName ? ` (${assetName})` : ''}`,
  };
}
