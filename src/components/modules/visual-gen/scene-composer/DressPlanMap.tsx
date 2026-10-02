'use client';

import type { DressGateLabel, DressPlan, DressRow } from '@/lib/visual-gen/scene-dress-plan';

/**
 * The placed plan, reviewable before anything reaches Blender: a top-down map of the
 * footprints (composition-local cm, +Y up, stacked props drawn inset and dashed) and a table
 * of what each instance IS — size, material, mass, stack and its crop-gate verdict.
 */
const GATE_STROKE: Record<DressGateLabel, string> = {
  pass: 'stroke-emerald-400',
  warn: 'stroke-amber-400',
  fail: 'stroke-red-400',
  'not run': 'stroke-[var(--text-muted)]',
  'not gated': 'stroke-[var(--border)]',
};

const GATE_TEXT: Record<DressGateLabel, string> = {
  pass: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-red-400',
  'not run': 'text-text-muted',
  'not gated': 'text-text-muted',
};

/** cm padding around the footprints so edge props are not clipped. */
const PAD_CM = 30;

function bounds(rows: readonly DressRow[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rows) {
    // Radius of the footprint's circumcircle: correct for any yaw.
    const rad = Math.hypot(r.sizeCm[0], r.sizeCm[1]) / 2;
    x0 = Math.min(x0, r.x - rad);
    x1 = Math.max(x1, r.x + rad);
    y0 = Math.min(y0, -r.y - rad);
    y1 = Math.max(y1, -r.y + rad);
  }
  return { x: x0 - PAD_CM, y: y0 - PAD_CM, w: x1 - x0 + 2 * PAD_CM, h: y1 - y0 + 2 * PAD_CM };
}

function Footprint({ row }: { row: DressRow }) {
  const inset = row.stackIndex > 0 ? 0.85 : 1;
  const [w, d] = row.sizeCm;
  return (
    <rect
      x={(-w * inset) / 2}
      y={(-d * inset) / 2}
      width={w * inset}
      height={d * inset}
      transform={`translate(${row.x} ${-row.y}) rotate(${-row.yawDeg})`}
      className={`fill-[var(--visual-gen)] ${GATE_STROKE[row.gate.label]}`}
      fillOpacity={row.stackIndex > 0 ? 0.35 : 0.18}
      strokeWidth={2}
      strokeDasharray={row.stackIndex > 0 ? '6 4' : undefined}
      vectorEffect="non-scaling-stroke"
    >
      <title>{`${row.instanceId} — ${w.toFixed(0)}×${d.toFixed(0)} cm${row.supportedBy ? `, on ${row.supportedBy}` : ''}`}</title>
    </rect>
  );
}

export function DressPlanMap({ plan }: { plan: DressPlan }) {
  if (plan.placed.length === 0) return null;
  const b = bounds(plan.placed);
  // Floor props first so stacked ones draw on top.
  const ordered = [...plan.placed].sort((a, c) => a.stackIndex - c.stackIndex);
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      role="img"
      aria-label={`Top-down plan of ${plan.placed.length} placed props over ${(b.w / 100).toFixed(1)} by ${(b.h / 100).toFixed(1)} m`}
      className="w-full max-h-64 rounded border border-border bg-surface-deep"
    >
      {ordered.map((r) => (
        <Footprint key={r.instanceId} row={r} />
      ))}
    </svg>
  );
}

function fmtSize(s: readonly [number, number, number]) {
  return s.map((v) => v.toFixed(0)).join('×');
}

export function DressPlanTable({ plan }: { plan: DressPlan }) {
  return (
    <div className="space-y-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal py-1">Instance</th>
            <th className="font-normal">Size (cm)</th>
            <th className="font-normal">Material</th>
            <th className="font-normal">Mass</th>
            <th className="font-normal">Stack</th>
            <th className="font-normal">Crop gate</th>
          </tr>
        </thead>
        <tbody>
          {plan.placed.map((r) => (
            <tr key={r.instanceId} className="border-t border-border text-text">
              <td className="py-1 font-mono">{r.instanceId}</td>
              <td>{fmtSize(r.sizeCm)}</td>
              <td>{r.material ?? '—'}</td>
              <td>{r.massKg === null ? '—' : `${r.massKg} kg`}</td>
              <td title={r.supportedBy ? `on ${r.supportedBy}` : 'on the floor'}>
                {r.stackIndex === 0 ? 'floor' : `+${r.stackIndex}`}
              </td>
              <td className={GATE_TEXT[r.gate.label]} title={r.gate.note}>
                {r.gate.label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.unplaced.length > 0 && (
        <ul className="text-xs text-amber-400 space-y-0.5" aria-label="Unplaced props">
          {plan.unplaced.map((u, i) => (
            <li key={`${u.assetId}-${i}`}>
              Not placed: {u.name} — {u.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
