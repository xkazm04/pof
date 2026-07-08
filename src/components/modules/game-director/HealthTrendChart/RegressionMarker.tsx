import { ACCENT_ORANGE } from '@/lib/chart-colors';

export function RegressionMarker({
  x, top, bottom, count, sessionName,
}: {
  x: number;
  top: number;
  bottom: number;
  count: number;
  sessionName: string;
}) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={bottom}
        stroke={ACCENT_ORANGE}
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.55"
      />
      <circle
        cx={x}
        cy={top + 2}
        r="3.5"
        fill={ACCENT_ORANGE}
        stroke="var(--surface)"
        strokeWidth="1"
      />
      <title>{`${sessionName}\n${count} regression alert${count !== 1 ? 's' : ''}`}</title>
    </g>
  );
}
