import type { StateType } from '../shared/state-machine-shared';
import type { StateNode, TransitionEdge } from './types';
import { LOCOMOTION_KEYWORDS, COMBAT_KEYWORDS, REACTION_KEYWORDS } from './constants';

// ── State type classification ──

export function classifyState(name: string, hasMontage: boolean): StateType {
  const lower = name.toLowerCase();
  if (REACTION_KEYWORDS.some((k) => lower.includes(k))) return 'reaction';
  if (COMBAT_KEYWORDS.some((k) => lower.includes(k))) return 'combat';
  if (LOCOMOTION_KEYWORDS.some((k) => lower.includes(k))) return 'locomotion';
  if (hasMontage) return 'montage';
  return 'other';
}

// ── Layout helpers ──

export function layoutStates(states: { name: string; hasMontage: boolean }[]): StateNode[] {
  const count = states.length;
  if (count === 0) return [];

  if (count <= 8) {
    const cx = 50, cy = 50;
    const rx = 34, ry = 32;
    return states.map((s, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      return {
        id: `scanned-${s.name}`,
        label: s.name,
        prompt: `Implement or improve the "${s.name}" state in the Animation Blueprint. Ensure it has proper animation assets, transition conditions, and blending configured.`,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        stateType: classifyState(s.name, s.hasMontage),
      };
    });
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const xPad = 14, yPad = 14;
  const xSpan = 72, ySpan = 72;

  return states.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `scanned-${s.name}`,
      label: s.name,
      prompt: `Implement or improve the "${s.name}" state in the Animation Blueprint. Ensure it has proper animation assets, transition conditions, and blending configured.`,
      x: xPad + (cols > 1 ? (col / (cols - 1)) * xSpan : xSpan / 2),
      y: yPad + (rows > 1 ? (row / (rows - 1)) * ySpan : ySpan / 2),
      stateType: classifyState(s.name, s.hasMontage),
    };
  });
}

// ── Simulation helpers ──

export function findReachableStates(transitions: TransitionEdge[], startId: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const t of transitions) {
      if (t.from === current && !reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }
  return reachable;
}

export function findDeadEnds(transitions: TransitionEdge[], stateIds: string[]): Set<string> {
  const deadEnds = new Set<string>();
  for (const id of stateIds) {
    const outgoing = transitions.filter((t) => t.from === id);
    if (outgoing.length === 0) deadEnds.add(id);
  }
  return deadEnds;
}
