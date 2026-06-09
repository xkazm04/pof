export type WarningSeverity = 'error' | 'warning' | 'info';

export type WarningKind =
  | 'unreachable-state'
  | 'soft-lock-deadend'
  | 'duplicate-priority'
  | 'duplicate-state-name'
  | 'unknown-flag-in-rule'
  | 'unknown-flag-in-state';

export interface ValidationWarning {
  kind: WarningKind;
  severity: WarningSeverity;
  stateIds: string[];
  transitionIds: string[];
  message: string;
}

interface StateLike {
  id: string;
  name: string;
  priority: number;
  flag: string;
  isDefault?: boolean;
}

interface TransitionLike {
  id: string;
  from: string;
  to: string;
  rule: string;
}

// UE5 boolean flag convention: lowercase 'b' followed by uppercase letter
const FLAG_PATTERN = /\bb[A-Z]\w*/g;

export function extractFlagsFromRule(rule: string): string[] {
  if (!rule) return [];
  const matches = rule.match(FLAG_PATTERN);
  return matches ? Array.from(new Set(matches)) : [];
}

function findEntryState<S extends StateLike>(states: S[]): S | undefined {
  return states.find((s) => s.isDefault) ?? states[0];
}

function buildAdjacency<T extends TransitionLike>(transitions: T[]): {
  forward: Map<string, string[]>;
  backward: Map<string, string[]>;
} {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const t of transitions) {
    if (!forward.has(t.from)) forward.set(t.from, []);
    forward.get(t.from)!.push(t.to);
    if (!backward.has(t.to)) backward.set(t.to, []);
    backward.get(t.to)!.push(t.from);
  }
  return { forward, backward };
}

function bfs(start: string, adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = adj.get(node) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited;
}

export function validateStateMachine<S extends StateLike, T extends TransitionLike>(
  states: S[],
  transitions: T[],
  knownFlags: readonly string[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  if (states.length === 0) return warnings;

  const knownFlagSet = new Set(knownFlags);
  const entry = findEntryState(states);
  const { forward, backward } = buildAdjacency(transitions);

  // 1. Unreachable states — no path from entry/default
  if (entry) {
    const reachable = bfs(entry.id, forward);
    for (const s of states) {
      if (!reachable.has(s.id)) {
        warnings.push({
          kind: 'unreachable-state',
          severity: 'error',
          stateIds: [s.id],
          transitionIds: [],
          message: `"${s.name}" is unreachable — no path from "${entry.name}".`,
        });
      }
    }
  }

  // 2. Soft-lock dead-ends — can enter but cannot return to entry.
  // Death-flag states are intentional and surface as info, not warning.
  if (entry) {
    const canReturn = bfs(entry.id, backward);
    for (const s of states) {
      if (s.id === entry.id) continue;
      if (canReturn.has(s.id)) continue;
      const outgoing = forward.get(s.id) ?? [];
      const isDeathLike = s.flag === 'bIsDead';
      const suffix = isDeathLike ? ' (Death state — intentional)' : '';
      warnings.push({
        kind: 'soft-lock-deadend',
        severity: isDeathLike ? 'info' : 'warning',
        stateIds: [s.id],
        transitionIds: [],
        message:
          outgoing.length === 0
            ? `"${s.name}" has no outgoing transitions — soft-lock dead-end${suffix}.`
            : `"${s.name}" cannot return to "${entry.name}"${suffix}.`,
      });
    }
  }

  // 3. Duplicate priority values
  const priorityGroups = new Map<number, S[]>();
  for (const s of states) {
    if (!priorityGroups.has(s.priority)) priorityGroups.set(s.priority, []);
    priorityGroups.get(s.priority)!.push(s);
  }
  for (const [priority, group] of priorityGroups) {
    if (group.length > 1) {
      warnings.push({
        kind: 'duplicate-priority',
        severity: 'warning',
        stateIds: group.map((s) => s.id),
        transitionIds: [],
        message: `Priority ${priority} is used by ${group.length} states: ${group.map((s) => s.name).join(', ')}.`,
      });
    }
  }

  // 4. Unknown flag on state.flag
  for (const s of states) {
    if (!s.flag || s.flag === '(default)') continue;
    if (!knownFlagSet.has(s.flag)) {
      warnings.push({
        kind: 'unknown-flag-in-state',
        severity: 'warning',
        stateIds: [s.id],
        transitionIds: [],
        message: `"${s.name}" uses unknown flag "${s.flag}". Add to KNOWN_FLAGS if intentional.`,
      });
    }
  }

  // 5. Unknown flag(s) referenced in transition rules
  const stateNameById = new Map(states.map((s) => [s.id, s.name]));
  for (const t of transitions) {
    const flags = extractFlagsFromRule(t.rule);
    const unknown = flags.filter((f) => !knownFlagSet.has(f));
    if (unknown.length > 0) {
      const fromName = stateNameById.get(t.from) ?? '?';
      const toName = stateNameById.get(t.to) ?? '?';
      warnings.push({
        kind: 'unknown-flag-in-rule',
        severity: 'warning',
        stateIds: [t.from, t.to],
        transitionIds: [t.id],
        message: `Transition ${fromName} → ${toName} references unknown flag(s): ${unknown.join(', ')}.`,
      });
    }
  }

  // 6. Duplicate state names — each state name becomes a UE5 C++ enum member
  // (EARPGAnimState::<name>), so two states sharing a name emit duplicate enumerators
  // and uncompilable C++. Nothing else flagged this, and the export is shown as authoritative.
  const nameGroups = new Map<string, S[]>();
  for (const s of states) {
    const key = s.name.trim();
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push(s);
  }
  for (const [name, group] of nameGroups) {
    if (group.length > 1) {
      warnings.push({
        kind: 'duplicate-state-name',
        severity: 'error',
        stateIds: group.map((s) => s.id),
        transitionIds: [],
        message: `State name "${name}" is used by ${group.length} states — generated C++ would have duplicate EARPGAnimState enumerators and fail to compile.`,
      });
    }
  }

  return warnings;
}

export function groupWarningsByState(warnings: ValidationWarning[]): Map<string, ValidationWarning[]> {
  const map = new Map<string, ValidationWarning[]>();
  for (const w of warnings) {
    for (const sid of w.stateIds) {
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(w);
    }
  }
  return map;
}

export function highestSeverity(warnings: ValidationWarning[]): WarningSeverity | null {
  if (warnings.length === 0) return null;
  if (warnings.some((w) => w.severity === 'error')) return 'error';
  if (warnings.some((w) => w.severity === 'warning')) return 'warning';
  return 'info';
}
