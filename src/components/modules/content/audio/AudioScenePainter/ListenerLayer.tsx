import { withOpacity, OPACITY_20 } from '@/lib/chart-colors';
import type { ListenerPoint } from '@/lib/audio-scene-audition';

/**
 * The LISTEN-mode listener puck. Drawn inside the zoomed <g>, so its size is
 * divided by `zoom` to stay constant on screen. It takes no pointer events: a
 * mousedown anywhere on the canvas (the puck included) moves it there.
 */
export function ListenerLayer({ listener, zoom, accentColor }: {
  listener: ListenerPoint | null;
  zoom: number;
  accentColor: string;
}) {
  if (!listener) return null;
  const r = 9 / zoom;
  return (
    <g
      data-testid="listener-puck"
      transform={`translate(${Math.round(listener.x)},${Math.round(listener.y)})`}
      style={{ pointerEvents: 'none' }}
      aria-label="Audition listener"
    >
      <circle r={r * 2.2} fill={withOpacity(accentColor, OPACITY_20)} />
      <circle r={r} fill="var(--surface-deep)" stroke={accentColor} strokeWidth={2 / zoom} />
      <path d={`M ${-r / 2} 0 L ${r / 2} 0 M 0 ${-r / 2} L 0 ${r / 2}`} stroke={accentColor} strokeWidth={1.5 / zoom} />
    </g>
  );
}
