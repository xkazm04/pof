/**
 * Plain-language explainer for animation state machines and combo chains.
 *
 * Renders deterministic English narratives from the in-memory state/transition
 * data so non-technical designers can reason about generated C++ without
 * reading priority-sorted if-cascades.
 */

export interface ExplainerState {
  id: string;
  name: string;
  priority: number;
  flag: string;
  isDefault?: boolean;
  montageRef?: string;
}

export interface ExplainerTransition {
  id: string;
  from: string;
  to: string;
  rule: string;
  description?: string;
}

export interface ExplainerSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ExplainerNarrative {
  summary: string;
  sections: ExplainerSection[];
}

// ── State machine explainer ──

/**
 * Build a plain-English narrative of the priority cascade and every transition.
 * Output mirrors the order ComputeAnimState() will evaluate flags at runtime.
 */
export function explainStateMachine(
  states: ExplainerState[],
  transitions: ExplainerTransition[],
): ExplainerNarrative {
  if (states.length === 0) {
    return {
      summary: 'No states defined yet — add states to see a plain-English breakdown.',
      sections: [],
    };
  }

  const sorted = [...states].sort((a, b) => a.priority - b.priority);
  const stateById = new Map(states.map((s) => [s.id, s] as const));
  const defaultState = sorted.find((s) => s.isDefault) ?? sorted[sorted.length - 1];
  const nonDefault = sorted.filter((s) => s !== defaultState);

  const summary = buildCascadeSummary(sorted, defaultState);

  // ── Priority cascade section ──
  const cascadeBullets: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s === defaultState) {
      cascadeBullets.push(
        `If none of the above flags are set, the character falls back to **${s.name}**${s.montageRef ? ` (plays ${s.montageRef})` : ''}.`,
      );
    } else {
      const prior = nonDefault.slice(0, nonDefault.indexOf(s));
      const prefix = prior.length === 0
        ? 'First,'
        : `Otherwise, if ${describeFlagsNotSet(prior)},`;
      cascadeBullets.push(
        `${prefix} if **${humanizeFlag(s.flag)}**, the character enters **${s.name}**${s.montageRef ? ` and plays ${s.montageRef}` : ''}.`,
      );
    }
  }

  // ── Transitions grouped by source state ──
  const transitionBullets: string[] = [];
  for (const s of sorted) {
    const outgoing = transitions.filter((t) => t.from === s.id);
    if (outgoing.length === 0) continue;
    for (const t of outgoing) {
      const target = stateById.get(t.to);
      if (!target) continue;
      transitionBullets.push(
        `While **${s.name}**, ${describeTransition(s, target, t)}.`,
      );
    }
  }

  // ── Orphan & unreachable detection ──
  const orphanBullets: string[] = [];
  const reachable = new Set<string>([defaultState.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of transitions) {
      if (reachable.has(t.from) && !reachable.has(t.to)) {
        reachable.add(t.to);
        changed = true;
      }
    }
  }
  for (const s of states) {
    if (!reachable.has(s.id) && !s.isDefault) {
      orphanBullets.push(
        `**${s.name}** is unreachable from the default state — nothing can transition into it. ${s.flag !== '(default)' ? `Make sure something sets \`${s.flag}\` and that a transition arrow points here.` : ''}`,
      );
    }
    const outgoing = transitions.filter((t) => t.from === s.id);
    if (outgoing.length === 0 && !s.isDefault) {
      orphanBullets.push(
        `**${s.name}** has no outgoing transitions — once entered, the character cannot leave this state.`,
      );
    }
  }

  const sections: ExplainerSection[] = [
    {
      heading: 'Priority cascade',
      paragraphs: [
        `Every animation tick, ComputeAnimState() asks "what should the character be doing right now?" by checking flags in priority order — the first match wins, no matter what was playing before.`,
      ],
      bullets: cascadeBullets,
    },
  ];

  if (transitionBullets.length > 0) {
    sections.push({
      heading: 'Transitions',
      paragraphs: [
        'These are the rules that move the character between states. The priority cascade above runs first; transitions only matter when two states could both be active.',
      ],
      bullets: transitionBullets,
    });
  }

  if (orphanBullets.length > 0) {
    sections.push({
      heading: 'Warnings',
      paragraphs: [
        'The state graph has issues worth reviewing:',
      ],
      bullets: orphanBullets,
    });
  }

  return { summary, sections };
}

function buildCascadeSummary(sorted: ExplainerState[], defaultState: ExplainerState): string {
  const nonDefault = sorted.filter((s) => s !== defaultState);
  if (nonDefault.length === 0) {
    return `The character is always in **${defaultState.name}** — no override states are defined.`;
  }
  const names = nonDefault.map((s) => `**${s.name}**`);
  const ordered = names.length === 1
    ? names[0]
    : names.length === 2
      ? `${names[0]} over ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, then ${names[names.length - 1]}`;
  return `The character always prioritizes ${ordered} over the default **${defaultState.name}** state.`;
}

function describeFlagsNotSet(states: ExplainerState[]): string {
  const flags = states.map((s) => negate(humanizeFlag(s.flag)));
  if (flags.length === 1) return flags[0];
  if (flags.length === 2) return `${flags[0]} and ${flags[1]}`;
  return `${flags.slice(0, -1).join(', ')}, and ${flags[flags.length - 1]}`;
}

/**
 * Convert UE5 hungarian-style flags (e.g. `bIsAttacking`) into plain English
 * ("the character is attacking"). Compound expressions stay verbatim inside backticks.
 */
function humanizeFlag(flag: string): string {
  if (!flag || flag === '(default)') return 'no other condition is set';
  if (flag.includes('&&') || flag.includes('||') || flag.includes('==')) {
    return `the rule \`${flag}\` is true`;
  }
  // bIsAttacking → "the character is attacking"
  const stripped = flag.replace(/^b/, '');
  const spaced = stripped
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
  if (spaced.startsWith('is ')) {
    return `the character ${spaced}`;
  }
  if (spaced.startsWith('can ') || spaced.startsWith('has ') || spaced.startsWith('should ')) {
    return `the character ${spaced}`;
  }
  return `the flag \`${flag}\` is set`;
}

function describeTransition(
  from: ExplainerState,
  to: ExplainerState,
  t: ExplainerTransition,
): string {
  const rule = t.rule.trim();
  const condition = rule
    ? describeRule(rule)
    : 'when the transition fires';
  const desc = t.description ? ` (${t.description.toLowerCase().replace(/\.$/, '')})` : '';
  return `the character moves to **${to.name}** ${condition}${desc}`;
}

function describeRule(rule: string): string {
  // Detect common UE5 anim rule patterns and humanize them.
  const trimmed = rule.trim();

  // "Montage ends..." → as-is
  if (/montage ends/i.test(trimmed)) return 'when the active montage finishes';

  // "(default)" or fallback
  if (/^\(default\)/i.test(trimmed)) return 'as the default fallback';

  // "StateTime > N"
  const stateTime = trimmed.match(/StateTime\s*>\s*([\d.]+)/i);
  if (stateTime) return `after ${stateTime[1]}s in this state`;

  // Compound rules with &&
  if (trimmed.includes('&&')) {
    const parts = trimmed.split('&&').map((p) => p.trim()).filter(Boolean);
    const phrased = parts.map(phrasePredicate);
    return `when ${joinAnd(phrased)}`;
  }

  // Simple `flag == true` / `flag == false`
  return `when ${phrasePredicate(trimmed)}`;
}

function phrasePredicate(p: string): string {
  const t = p.trim();
  const eqTrue = t.match(/^!?([A-Za-z_][A-Za-z0-9_]*)\s*==\s*true$/);
  if (eqTrue) {
    const negated = t.startsWith('!');
    const phrase = humanizeFlag(eqTrue[1]);
    return negated ? negate(phrase) : phrase;
  }
  const eqFalse = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*==\s*false$/);
  if (eqFalse) return negate(humanizeFlag(eqFalse[1]));
  const bangFlag = t.match(/^!([A-Za-z_][A-Za-z0-9_]*)$/);
  if (bangFlag) return negate(humanizeFlag(bangFlag[1]));
  const plainFlag = t.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (plainFlag) return humanizeFlag(plainFlag[1]);
  return `\`${t}\` holds`;
}

function negate(phrase: string): string {
  return phrase
    .replace('the character is ', 'the character is not ')
    .replace('the character can ', 'the character cannot ')
    .replace('the character has ', 'the character does not have ')
    .replace('the character should ', 'the character should not ')
    .replace('the flag ', 'the flag is cleared for ')
    .replace('the rule ', 'the rule is false for ');
}

function joinAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// ── Combo chain explainer ──

export interface ExplainerComboNode {
  id: string;
  name: string;
  montage: string;
  damage: number;
}

export interface ExplainerComboEdge {
  from: string;
  to: string;
  window?: string;
  inputWindow?: string;
  label?: string;
}

export function explainComboChain(
  nodes: ExplainerComboNode[],
  edges: ExplainerComboEdge[],
): ExplainerNarrative {
  if (nodes.length === 0) {
    return { summary: 'No combo nodes defined yet.', sections: [] };
  }

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const outgoing = new Map<string, ExplainerComboEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.from) ?? [];
    list.push(e);
    outgoing.set(e.from, list);
  }

  // Find chain roots (no incoming edges)
  const hasIncoming = new Set(edges.map((e) => e.to));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));

  const summary = roots.length === 1
    ? `The combo starts with **${roots[0].name}** and branches into ${nodes.length - 1} follow-up${nodes.length - 1 === 1 ? '' : 's'}.`
    : `${roots.length} independent combo starters: ${roots.map((r) => `**${r.name}**`).join(', ')}.`;

  // ── Step-by-step bullets ──
  const stepBullets: string[] = [];
  for (const node of nodes) {
    const outs = outgoing.get(node.id) ?? [];
    const dmg = `${node.damage} damage`;
    if (outs.length === 0) {
      stepBullets.push(
        `**${node.name}** (${node.montage}) deals ${dmg} and ends the combo — nothing chains from here.`,
      );
    } else if (outs.length === 1) {
      const e = outs[0];
      const target = byId.get(e.to);
      if (!target) continue;
      const window = describeWindow(e);
      stepBullets.push(
        `**${node.name}** (${node.montage}) deals ${dmg}; ${window}, press the next input to chain into **${target.name}**.`,
      );
    } else {
      const branches = outs
        .map((e) => {
          const target = byId.get(e.to);
          if (!target) return null;
          return `**${target.name}** ${describeWindow(e, true)}`;
        })
        .filter(Boolean) as string[];
      stepBullets.push(
        `**${node.name}** (${node.montage}) deals ${dmg} and branches into: ${branches.join(', ')}.`,
      );
    }
  }

  // ── Damage potential ──
  const totalDamage = nodes.reduce((sum, n) => sum + n.damage, 0);
  const peakNode = nodes.reduce((best, n) => (n.damage > best.damage ? n : best));
  const damageBullet = `Full chain potential is **${totalDamage} damage** across ${nodes.length} hits; the peak strike is **${peakNode.name}** at ${peakNode.damage} damage.`;

  return {
    summary,
    sections: [
      {
        heading: 'Combo flow',
        paragraphs: [
          'Each node is one attack montage; arrows show the combo windows where pressing the input early enough chains the next hit. Miss the window and the combo resets.',
        ],
        bullets: stepBullets,
      },
      {
        heading: 'Damage potential',
        paragraphs: [damageBullet],
      },
    ],
  };
}

function describeWindow(e: ExplainerComboEdge, asSuffix = false): string {
  const window = e.window ?? e.inputWindow;
  if (!window) return asSuffix ? '' : 'on the next input';
  return asSuffix ? `(window ${window})` : `within the ${window} window`;
}
