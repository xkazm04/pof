'use client';

import { MCP_FORM_RADIUS } from '@/components/blender-mcp/McpFormControls';
import type { LodPlan, LodGrade, LodLevelGrade, Lod0Verdict } from '@/lib/visual-gen/lod-plan';

/**
 * The LOD chain in triangles: LOD0's standing against its class budget, each
 * level's target, and — after a run — what Blender's `lod` receipt says it got.
 * A level with no receipt reads "not measured", never "within budget".
 */

const fmt = (n: number) => n.toLocaleString('en-US');
const OK = 'text-green-400';
const WARN = 'text-amber-400';
const BAD = 'text-red-400';
const MUTED = 'text-text-muted';

const LOD0_LABEL: Record<Lod0Verdict, [string, string]> = {
  'within-target': ['within target', OK],
  'over-target': ['over target', WARN],
  'over-ceiling': ['over ceiling', BAD],
  unmeasured: ['not measured', MUTED],
  unclassed: ['no class', MUTED],
};

function levelLabel(g: LodLevelGrade | undefined): [string, string] {
  if (!g) return ['pending', MUTED];
  switch (g.state) {
    case 'honoured':
      return ['honoured', OK];
    case 'over':
      return [g.cause === 'quad-trap' ? 'over (quad trap)' : 'over', BAD];
    case 'under':
      return ['under', WARN];
    default:
      return ['not measured', WARN];
  }
}

const CELL = 'px-2 py-1 text-left';

export function LodPlanTable({ plan, grade }: { plan: LodPlan; grade: LodGrade | null }) {
  const { lod0 } = plan;
  const [lod0Text, lod0Tone] = LOD0_LABEL[lod0.verdict];
  const byLevel = new Map(grade?.levels.map((g) => [g.level, g]));

  return (
    <div className={`${MCP_FORM_RADIUS} border border-border bg-surface-secondary p-3 space-y-2`}>
      <table className="w-full text-xs text-text" aria-label="LOD plan in triangles">
        <thead className={MUTED}>
          <tr>
            <th className={CELL}>Level</th>
            <th className={CELL}>Target tris</th>
            <th className={CELL}>Got tris</th>
            <th className={CELL}>Grade</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          <tr>
            <td className={CELL}>LOD0 (source)</td>
            <td className={CELL}>{lod0.target === undefined ? '—' : fmt(lod0.target)}</td>
            <td className={CELL}>{lod0.tris === undefined ? 'not measured' : fmt(lod0.tris)}</td>
            <td className={`${CELL} ${lod0Tone}`}>{lod0Text}</td>
          </tr>
          {plan.levels.map((l) => {
            const g = byLevel.get(l.level);
            const target = l.targetTris ?? g?.targetTris;
            const [text, tone] = levelLabel(g);
            return (
              <tr key={l.level}>
                <td className={CELL}>LOD{l.level}</td>
                <td className={CELL}>{target === undefined ? `${Math.round(l.ratio * 100)}% · not measured` : fmt(target)}</td>
                <td className={CELL}>{g?.tris === undefined ? '—' : fmt(g.tris)}</td>
                <td className={`${CELL} ${tone}`}>{text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={`text-xs ${lod0Tone}`}>{lod0.reason}</p>
      {grade && (
        <div role="status" aria-live="polite" className="space-y-0.5">
          <p className={`text-xs font-semibold ${grade.allHonoured ? OK : WARN}`}>{grade.summary}</p>
          {grade.levels
            .filter((g) => g.reason)
            .map((g) => (
              <p key={g.level} className={`text-xs ${MUTED}`}>
                {g.reason}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
