import { useReducedMotion } from 'framer-motion';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { TRANSITION_STYLES } from './constants';
import type { TransitionLine } from './types';

interface TransitionLinesProps {
  lines: TransitionLine[];
  deleteTransition: (id: string) => void;
}

export function TransitionLines({ lines, deleteTransition }: TransitionLinesProps) {
  // SMIL <animate> is not covered by the global prefers-reduced-motion CSS rule.
  const reduceMotion = useReducedMotion();
  return (
    <>
      {lines.map((ln) => {
        const styleColor = TRANSITION_STYLES[ln.style].color;
        const isDashed = ln.style === 'loading-screen' || ln.style === 'portal';
        const conditionLabel = (ln.condition.length > 20 ? ln.condition.slice(0, 20) + '...' : ln.condition).toUpperCase();
        return (
          <g key={ln.id}>
            <line
              x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke={styleColor}
              strokeWidth={2}
              strokeDasharray={isDashed ? '6,4' : undefined}
              opacity={0.3}
              className="transition-colors duration-300"
            />

            {/* Data Flow Core */}
            <line
              x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke={styleColor}
              strokeWidth={1}
              strokeDasharray="4 12"
              className="pointer-events-none"
            >
              {!reduceMotion && <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1s" repeatCount="indefinite" />}
            </line>

            {/* Condition badge at midpoint */}
            {ln.condition && (
              <g transform={`translate(${(ln.x1 + ln.x2) / 2}, ${(ln.y1 + ln.y2) / 2 - 12})`}>
                <rect
                  x={-conditionLabel.length * 3.6 - 6}
                  y={-8}
                  width={conditionLabel.length * 7.2 + 12}
                  height={16}
                  rx={4}
                  fill="rgba(5,5,16,0.9)"
                  stroke={STATUS_WARNING}
                  strokeWidth={1}
                  style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
                />
                <text
                  x={0} y={3}
                  style={{ fontSize: 12 }}
                  fill={STATUS_WARNING}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {conditionLabel}
                </text>
              </g>
            )}
            {/* Hit area for click */}
            <line
              x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke="transparent" strokeWidth={12}
              style={{ cursor: 'pointer' }}
              onContextMenu={(e) => { e.preventDefault(); deleteTransition(ln.id); }}
            >
              <title>{`${ln.fromName} to ${ln.toName}. Right-click to remove.`}</title>
            </line>
          </g>
        );
      })}
    </>
  );
}
