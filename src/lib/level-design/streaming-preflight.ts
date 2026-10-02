/**
 * Streaming preflight — what will not compile, what will hitch, and the
 * one-click fix for each, computed from the plan alone before Generate.
 *
 * Policy: only findings that guarantee broken C++ (`duplicate-identifier`,
 * `invalid-identifier` — the EWorldZone enumerators) block Generate. The rest
 * are named consequences: `unreachable` is an error the designer must see but
 * compiles; `seamless-hitch` / `non-adjacent` are warnings whose fix is a
 * planner op the designer clicks — never an automatic edit. A rule that cannot
 * evaluate says so (`status: 'not-evaluated'`) rather than passing silently.
 *
 * Distances are Chebyshev (the square the planner draws around a selected
 * zone), so a diagonal neighbour is adjacent. Transitions are undirected here,
 * as the reducer's `link` treats A→B and B→A as the same edge.
 */
import type { StreamingOp, StreamingZone, StreamingZonePlannerConfig, ZoneTransition } from '@/lib/level-design/streaming-plan';

export type PreflightRule = 'duplicate-identifier' | 'invalid-identifier' | 'unreachable' | 'seamless-hitch' | 'non-adjacent';
export type PreflightSeverity = 'error' | 'warning';

export type PreflightFix =
  | { kind: 'updateZone'; zoneId: string; patch: Partial<Omit<StreamingZone, 'id'>> }
  | { kind: 'updateTransition'; transitionId: string; patch: Partial<Omit<ZoneTransition, 'id'>> };

export interface PreflightFinding {
  rule: PreflightRule;
  severity: PreflightSeverity;
  status: 'fail' | 'not-evaluated';
  /** True only for findings that guarantee the generated C++ will not compile. */
  blocksGenerate: boolean;
  zoneIds: string[];
  transitionId?: string;
  identifier?: string;
  distance?: number;
  message: string;
  fix?: PreflightFix;
  fixLabel?: string;
}

export interface StreamingPreflight {
  findings: PreflightFinding[];
  blocksGenerate: boolean;
}

export interface StreamingResidency {
  /** zoneId → ids of every zone resident while the player stands there, in plan order. */
  byZone: Record<string, string[]>;
  peak: { zoneId: string; count: number; of: number } | null;
}

/** THE EWorldZone enumerator for a zone name — the prompt builder emits exactly this. */
export function zoneEnumIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

const CPP_KEYWORDS = new Set([
  'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'delete', 'do',
  'double', 'else', 'enum', 'explicit', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int',
  'long', 'namespace', 'new', 'nullptr', 'operator', 'private', 'protected', 'public', 'return', 'short',
  'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef',
  'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while',
]);

function identifierProblem(id: string): string | null {
  if (id === '') return 'is empty once non-alphanumerics are stripped';
  if (/^[0-9]/.test(id)) return 'starts with a digit';
  if (CPP_KEYWORDS.has(id)) return 'is a C++ keyword';
  return null;
}

export const chebyshev = (a: StreamingZone, b: StreamingZone): number =>
  Math.max(Math.abs(a.gridX - b.gridX), Math.abs(a.gridY - b.gridY));

/** Whether `zone` is loaded while the player stands in `at`. */
const residentFrom = (at: StreamingZone, zone: StreamingZone): boolean =>
  zone.id === at.id || zone.alwaysLoaded || chebyshev(at, zone) <= zone.preloadRadius;

/** A name whose identifier is valid and not in `taken`: "Town" → "Town 2", "1st Floor" → "Zone 1st Floor". */
function uniqueName(zone: StreamingZone, taken: ReadonlySet<string>): string {
  const stem = identifierProblem(zoneEnumIdentifier(zone.name)) ? `Zone ${zone.name.replace(/[^a-zA-Z0-9 ]/g, '')}`.trim() : zone.name;
  for (let n = 1; ; n++) {
    const name = n === 1 ? stem : `${stem} ${n}`;
    if (!taken.has(zoneEnumIdentifier(name))) return name;
  }
}

function identifierFindings(zones: readonly StreamingZone[]): PreflightFinding[] {
  const out: PreflightFinding[] = [];
  const taken = new Set(zones.map((z) => zoneEnumIdentifier(z.name)));
  const groups = new Map<string, StreamingZone[]>();
  for (const z of zones) {
    const id = zoneEnumIdentifier(z.name);
    const problem = identifierProblem(id);
    if (problem) {
      const name = uniqueName(z, taken);
      out.push({
        rule: 'invalid-identifier', severity: 'error', status: 'fail', blocksGenerate: true, zoneIds: [z.id], identifier: id,
        message: `'${z.name}' becomes EWorldZone identifier '${id}', which ${problem} — the enum will not compile.`,
        fix: { kind: 'updateZone', zoneId: z.id, patch: { name } }, fixLabel: `Rename to '${name}'`,
      });
      continue;
    }
    groups.set(id, [...(groups.get(id) ?? []), z]);
  }
  for (const [id, group] of groups) {
    if (group.length < 2) continue;
    const later = group[group.length - 1];
    const name = uniqueName(later, taken);
    out.push({
      rule: 'duplicate-identifier', severity: 'error', status: 'fail', blocksGenerate: true,
      zoneIds: group.map((z) => z.id), identifier: id,
      message: `Duplicate EWorldZone identifier '${id}' (${group.length} zones) — the enum will not compile.`,
      fix: { kind: 'updateZone', zoneId: later.id, patch: { name } }, fixLabel: `Rename the last to '${name}'`,
    });
  }
  return out;
}

function reachabilityFindings(config: StreamingZonePlannerConfig): PreflightFinding[] {
  const { zones, transitions } = config;
  if (zones.length === 0) return [];
  const roots = zones.filter((z) => z.alwaysLoaded);
  if (roots.length === 0) {
    return [{
      rule: 'unreachable', severity: 'warning', status: 'not-evaluated', blocksGenerate: false, zoneIds: [],
      message: 'Reachability not evaluated: no zone is Always Loaded, so there is no start zone to walk from.',
    }];
  }
  const seen = new Set(roots.map((z) => z.id));
  const queue = [...seen];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const t of transitions) {
      const next = t.fromId === at ? t.toId : t.toId === at ? t.fromId : null;
      if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return zones.filter((z) => !seen.has(z.id)).map((z) => ({
    rule: 'unreachable' as const, severity: 'error' as const, status: 'fail' as const, blocksGenerate: false, zoneIds: [z.id],
    message: `'${z.name}' has no transition path from a persistent zone — the player can never enter it.`,
  }));
}

function transitionFindings(config: StreamingZonePlannerConfig): PreflightFinding[] {
  const out: PreflightFinding[] = [];
  const byId = new Map(config.zones.map((z) => [z.id, z]));
  for (const t of config.transitions) {
    const a = byId.get(t.fromId);
    const b = byId.get(t.toId);
    if (!a || !b || t.style !== 'seamless') continue;
    const distance = chebyshev(a, b);
    if (distance > 1) {
      out.push({
        rule: 'non-adjacent', severity: 'warning', status: 'fail', blocksGenerate: false, zoneIds: [a.id, b.id],
        transitionId: t.id, distance,
        message: `Seamless ${a.name} → ${b.name} spans ${distance} cells: the zones share no boundary for a trigger volume.`,
        fix: { kind: 'updateTransition', transitionId: t.id, patch: { style: 'portal' } }, fixLabel: 'Make it a portal',
      });
      continue;
    }
    // A seamless boundary is crossed both ways; each side must already be resident from the other.
    for (const [from, to] of [[a, b], [b, a]] as const) {
      if (residentFrom(from, to)) continue;
      out.push({
        rule: 'seamless-hitch', severity: 'warning', status: 'fail', blocksGenerate: false, zoneIds: [from.id, to.id],
        transitionId: t.id, distance,
        message: `Seamless ${from.name} → ${to.name}: ${to.name} (preload radius ${to.preloadRadius}) is not loaded from ${from.name} — crossing will hitch.`,
        fix: { kind: 'updateZone', zoneId: to.id, patch: { preloadRadius: distance } },
        fixLabel: `Set ${to.name} preload radius to ${distance}`,
      });
    }
  }
  return out;
}

export function preflightStreamingPlan(config: StreamingZonePlannerConfig): StreamingPreflight {
  const findings = [...identifierFindings(config.zones), ...reachabilityFindings(config), ...transitionFindings(config)];
  return { findings, blocksGenerate: findings.some((f) => f.blocksGenerate) };
}

export function residency(config: StreamingZonePlannerConfig): StreamingResidency {
  const byZone: Record<string, string[]> = {};
  let peak: StreamingResidency['peak'] = null;
  for (const at of config.zones) {
    const resident = config.zones.filter((z) => residentFrom(at, z)).map((z) => z.id);
    byZone[at.id] = resident;
    if (!peak || resident.length > peak.count) peak = { zoneId: at.id, count: resident.length, of: config.zones.length };
  }
  return { byZone, peak };
}

/** The planner op a fix dispatches — fixes are ordinary, undoable-by-hand edits. */
export function fixToOp(fix: PreflightFix): StreamingOp {
  return fix.kind === 'updateZone'
    ? { type: 'updateZone', zoneId: fix.zoneId, patch: fix.patch }
    : { type: 'updateTransition', transitionId: fix.transitionId, patch: fix.patch };
}
