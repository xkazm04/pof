import { screenIdentifier } from '@/lib/prompts/menu-flow';
import type { MenuFlowConfig, ScreenNode, ScreenTransition } from './types';

// ── Menu Flow lint ──
//
// Judges a flow BEFORE it is exported into a UE C++ codegen run. Errors are topologies
// the generated code cannot compile with (a duplicate or invalid UCLASS / UENUM
// identifier) and block Export; warnings compile but are dubious (a screen no route
// reaches, a trigger that names no widget on its source screen). Every issue carries
// a one-click fix (`applyMenuFlowFix`). Identifiers come from the prompt builder's own
// `screenIdentifier`, so the check and the codegen cannot drift.

export type MenuFlowIssueKind = 'duplicate-identifier' | 'invalid-identifier' | 'unreachable' | 'unbound-trigger';
export type MenuFlowSeverity = 'error' | 'warning';

export interface MenuFlowIssue {
  kind: MenuFlowIssueKind;
  severity: MenuFlowSeverity;
  message: string;
  /** Label for the one-click fix button. */
  fix: string;
  /** Screens the issue is about (duplicates: every screen sharing the identifier, in order). */
  screenIds: string[];
  identifier?: string;
  transitionId?: string;
}

/** Fallback trigger when a source screen has no widget left to bind. */
export const FALLBACK_TRIGGER = 'Button Click';

const identKey = (name: string) => screenIdentifier(name).toLowerCase();

/** Identifiers whose `U<id>Widget` is an existing UMG class (UUserWidget, UPanelWidget, UContentWidget). */
const ENGINE_CLASS_IDENTS = new Set(['user', 'panel', 'content']);

/** Valid screen identifier: non-empty, not digit-led, and not shadowing an engine widget class. */
function isValidIdentifier(ident: string): boolean {
  return ident.length > 0 && !/^[0-9]/.test(ident) && !ENGINE_CLASS_IDENTS.has(ident.toLowerCase());
}

function invalidReason(name: string, ident: string): string {
  if (!ident) return `"${name}" has no letters or digits - it yields no C++ identifier`;
  if (/^[0-9]/.test(ident)) return `"${name}" becomes ${ident}, which starts with a digit - not a valid UENUM entry`;
  return `"${name}" becomes U${ident}Widget, which is already an engine UMG class`;
}

/** Root of the flow: first splash, else first main menu, else the first screen. */
export function flowRoot(screens: ScreenNode[]): ScreenNode | undefined {
  return screens.find((s) => s.type === 'splash') ?? screens.find((s) => s.type === 'main-menu') ?? screens[0];
}

/** First widget on the source screen not already used as one of its outgoing triggers. */
export function defaultTrigger(source: ScreenNode | undefined, transitions: ScreenTransition[]): string {
  if (!source) return FALLBACK_TRIGGER;
  const used = new Set(transitions.filter((t) => t.fromId === source.id).map((t) => t.trigger));
  return source.widgets.find((w) => !used.has(w)) ?? FALLBACK_TRIGGER;
}

/**
 * A screen name whose identifier collides with none of `taken` (lower-cased identifiers).
 * `base` itself when free, else `base 2`, `base 3`, ...
 */
export function uniqueScreenName(base: string, taken: Set<string>): string {
  if (isValidIdentifier(screenIdentifier(base)) && !taken.has(identKey(base))) return base;
  for (let k = 2; ; k++) {
    const candidate = `${base} ${k}`;
    if (!taken.has(identKey(candidate))) return candidate;
  }
}

/** The next free `Screen N` name (N starts past the current screen count). */
export function nextScreenName(screens: ScreenNode[]): string {
  const taken = new Set(screens.map((s) => identKey(s.name)));
  for (let n = screens.length + 1; ; n++) {
    const candidate = `Screen ${n}`;
    if (!taken.has(identKey(candidate))) return candidate;
  }
}

function reachableFrom(root: ScreenNode, transitions: ScreenTransition[]): Set<string> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => adj.set(a, [...(adj.get(a) ?? []), b]);
  for (const t of transitions) {
    link(t.fromId, t.toId);
    if (t.bidirectional) link(t.toId, t.fromId);
  }
  const seen = new Set([root.id]);
  const queue = [root.id];
  while (queue.length > 0) {
    for (const next of adj.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

export function lintMenuFlow(config: MenuFlowConfig): MenuFlowIssue[] {
  const { screens, transitions } = config;
  const issues: MenuFlowIssue[] = [];

  // Identifiers: invalid first, then duplicates among the valid ones (Windows file
  // names are case-insensitive, so UFooWidget.h and UfooWidget.h collide too).
  const groups = new Map<string, ScreenNode[]>();
  for (const s of screens) {
    const ident = screenIdentifier(s.name);
    if (!isValidIdentifier(ident)) {
      issues.push({
        kind: 'invalid-identifier', severity: 'error', screenIds: [s.id], identifier: ident,
        message: invalidReason(s.name, ident),
        fix: 'Rename screen',
      });
      continue;
    }
    const key = ident.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ident = screenIdentifier(group[0].name);
    issues.push({
      kind: 'duplicate-identifier', severity: 'error', screenIds: group.map((s) => s.id), identifier: ident,
      message: `${group.length} screens become U${ident}Widget (${group.map((s) => `"${s.name}"`).join(', ')}) - duplicate class and enum entry`,
      fix: 'Rename duplicates',
    });
  }

  const root = flowRoot(screens);
  if (root) {
    const seen = reachableFrom(root, transitions);
    for (const s of screens) {
      if (seen.has(s.id)) continue;
      issues.push({
        kind: 'unreachable', severity: 'warning', screenIds: [s.id],
        message: `"${s.name}" has no route from ${root.name}`,
        fix: `Link from ${root.name}`,
      });
    }
  }

  const byId = new Map(screens.map((s) => [s.id, s]));
  for (const t of transitions) {
    const from = byId.get(t.fromId);
    const to = byId.get(t.toId);
    if (!from || !to || from.widgets.includes(t.trigger)) continue;
    issues.push({
      kind: 'unbound-trigger', severity: 'warning', screenIds: [from.id], transitionId: t.id,
      message: `Route ${from.name} -> ${to.name}: trigger "${t.trigger}" is not a widget on ${from.name}`,
      fix: from.widgets.length > 0 ? 'Bind to a widget' : `Add "${t.trigger}" widget`,
    });
  }

  return issues;
}

/** True when any issue is an error - the flow cannot compile and must not be exported. */
export function exportBlockers(issues: MenuFlowIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

function renameScreens(config: MenuFlowConfig, ids: string[]): MenuFlowConfig {
  const renaming = new Set(ids);
  const taken = new Set(config.screens.filter((s) => !renaming.has(s.id)).map((s) => identKey(s.name)));
  const screens = config.screens.map((s) => {
    if (!renaming.has(s.id)) return s;
    const ident = screenIdentifier(s.name);
    const base = ident === '' ? 'Screen'
      : /^[0-9]/.test(ident) ? `Screen ${s.name}`
        : isValidIdentifier(ident) ? s.name : `${s.name} Screen`;
    const name = uniqueScreenName(base, taken);
    taken.add(identKey(name));
    return { ...s, name };
  });
  return { ...config, screens };
}

/** Apply the one-click fix for `issue`, returning a new config (the input is not mutated). */
export function applyMenuFlowFix(config: MenuFlowConfig, issue: MenuFlowIssue): MenuFlowConfig {
  switch (issue.kind) {
    case 'invalid-identifier':
      return renameScreens(config, issue.screenIds);
    case 'duplicate-identifier':
      return renameScreens(config, issue.screenIds.slice(1)); // the first keeps its name
    case 'unreachable': {
      const root = flowRoot(config.screens);
      const target = issue.screenIds[0];
      if (!root || !target || root.id === target) return config;
      const ids = new Set(config.transitions.map((t) => t.id));
      let id = `tr-fix-${target}`;
      for (let k = 2; ids.has(id); k++) id = `tr-fix-${target}-${k}`;
      const transition: ScreenTransition = {
        id, fromId: root.id, toId: target, trigger: defaultTrigger(root, config.transitions), bidirectional: false,
      };
      return { ...config, transitions: [...config.transitions, transition] };
    }
    case 'unbound-trigger': {
      const t = config.transitions.find((x) => x.id === issue.transitionId);
      const from = t && config.screens.find((s) => s.id === t.fromId);
      if (!t || !from) return config;
      if (from.widgets.length === 0) {
        const screens = config.screens.map((s) => (s.id === from.id ? { ...s, widgets: [...s.widgets, t.trigger] } : s));
        return { ...config, screens };
      }
      const others = config.transitions.filter((x) => x.id !== t.id);
      const trigger = from.widgets.find((w) => !others.some((x) => x.fromId === from.id && x.trigger === w)) ?? from.widgets[0];
      return { ...config, transitions: config.transitions.map((x) => (x.id === t.id ? { ...x, trigger } : x)) };
    }
  }
}
