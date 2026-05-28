import type { CrashReport, CrashPattern, CrashSeverity } from '@/types/crash-analyzer';

type HealthReport = Pick<CrashReport, 'id' | 'mappedModule' | 'severity'>;
type HealthPattern = Pick<CrashPattern, 'crashIds' | 'occurrences' | 'name' | 'isSystemic'>;

export interface ModulePattern {
  name: string;
  occurrences: number;
  isSystemic: boolean;
}

export interface ModuleHealthNode {
  moduleId: string;
  crashCount: number;
  riskScore: number;
  maxSeverity: CrashSeverity | 'none';
  patternCount: number;
  systemicCount: number;
  topPatterns: ModulePattern[];
}

export interface PositionedHealthNode {
  node: ModuleHealthNode;
  x: number;
  y: number;
  r: number;
}

const SEV_WEIGHT: Record<CrashSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEV_RANK: CrashSeverity[] = ['low', 'medium', 'high', 'critical'];

function worse(a: CrashSeverity | 'none', b: CrashSeverity): CrashSeverity {
  if (a === 'none') return b;
  return SEV_RANK.indexOf(b) > SEV_RANK.indexOf(a) ? b : a;
}

/** Aggregate per-module crash health from reports + detected patterns. Pure. */
export function buildModuleHealth(input: { reports: HealthReport[]; patterns: HealthPattern[] }): ModuleHealthNode[] {
  const moduleOf = new Map<string, string>();
  const byModule = new Map<string, HealthReport[]>();
  for (const r of input.reports) {
    const m = r.mappedModule ?? 'unmapped';
    moduleOf.set(r.id, m);
    const list = byModule.get(m);
    if (list) list.push(r); else byModule.set(m, [r]);
  }

  const patternsByModule = new Map<string, ModulePattern[]>();
  for (const p of input.patterns) {
    const mods = new Set<string>();
    for (const cid of p.crashIds) { const m = moduleOf.get(cid); if (m) mods.add(m); }
    for (const m of mods) {
      const arr = patternsByModule.get(m) ?? [];
      arr.push({ name: p.name, occurrences: p.occurrences, isSystemic: p.isSystemic });
      patternsByModule.set(m, arr);
    }
  }

  const nodes: ModuleHealthNode[] = [];
  for (const [moduleId, mreports] of byModule) {
    let maxSeverity: CrashSeverity | 'none' = 'none';
    let weightSum = 0;
    for (const r of mreports) { weightSum += SEV_WEIGHT[r.severity]; maxSeverity = worse(maxSeverity, r.severity); }
    const pats = (patternsByModule.get(moduleId) ?? []).slice().sort((a, b) => b.occurrences - a.occurrences);
    const systemicCount = pats.filter((p) => p.isSystemic).length;
    nodes.push({
      moduleId,
      crashCount: mreports.length,
      riskScore: weightSum + 2 * systemicCount,
      maxSeverity,
      patternCount: pats.length,
      systemicCount,
      topPatterns: pats.slice(0, 3),
    });
  }
  return nodes.sort((a, b) => b.riskScore - a.riskScore);
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic phyllotaxis risk-map layout: highest risk at the centre, spiralling out. Pure. */
export function layoutHealthMap(nodes: ModuleHealthNode[], opts: { width: number; height: number }): PositionedHealthNode[] {
  const sorted = nodes.slice().sort((a, b) => b.riskScore - a.riskScore);
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const margin = 24;
  const minR = 10;
  const maxR = 34;
  const maxCrash = Math.max(1, ...sorted.map((n) => n.crashCount));
  const usable = Math.max(1, Math.min(opts.width, opts.height) / 2 - margin - maxR);
  const spread = usable / Math.max(1, Math.sqrt(Math.max(1, sorted.length - 1)));
  return sorted.map((node, i) => {
    const radius = spread * Math.sqrt(i);
    const angle = i * GOLDEN_ANGLE;
    const r = minR + (maxR - minR) * Math.sqrt(node.crashCount / maxCrash);
    return { node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), r };
  });
}
