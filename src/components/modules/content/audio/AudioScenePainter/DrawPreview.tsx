import type { DrawState } from './types';

export function DrawPreview({ drawState, accentColor }: {
  drawState: DrawState | null;
  accentColor: string;
}) {
  if (!drawState) return null;
  return ((ds: DrawState) => {
    const x = Math.min(ds.startX, ds.currentX);
    const y = Math.min(ds.startY, ds.currentY);
    const w = Math.abs(ds.currentX - ds.startX);
    const h = Math.abs(ds.currentY - ds.startY);

    if (ds.shape === 'circle') {
      const r = Math.max(w, h) / 2;
      return (
        <circle
          cx={ds.startX} cy={ds.startY}
          r={r}
          fill={`url(#radar-glow)`}
          stroke={accentColor}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      );
    }

    return (
      <rect
        x={x} y={y} width={w} height={h}
        rx={2}
        fill={`url(#radar-glow)`}
        stroke={accentColor}
        strokeWidth={1}
        strokeDasharray="4,4"
      />
    );
  })(drawState);
}
