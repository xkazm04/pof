'use client';

import type { ScreenTransition } from './types';

interface TransitionArrowProps {
  tr: ScreenTransition;
  getNodeCenter: (id: string) => { x: number; y: number };
  getArrowPath: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    bidir: boolean
  ) => { line: string; arrows: string; midX?: number; midY?: number };
  toggleBidirectional: (id: string) => void;
  deleteTransition: (id: string) => void;
}

export function TransitionArrow({ tr, getNodeCenter, getArrowPath, toggleBidirectional, deleteTransition }: TransitionArrowProps) {
  const from = getNodeCenter(tr.fromId);
  const to = getNodeCenter(tr.toId);
  const { line, arrows, midX, midY } = getArrowPath(from, to, tr.bidirectional);

  return (
    <g key={tr.id}>
      {/* Visible line */}
      <path d={line} stroke="rgba(167,139,250,0.5)" strokeWidth={2} fill="none" style={{ filter: 'url(#neon-glow)' }} />
      <path d={arrows} stroke="rgba(167,139,250,0.8)" strokeWidth={2} fill="none" strokeLinecap="round" />

      {/* Trigger label */}
      {midX !== undefined && midY !== undefined && (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-tr.trigger.length * 3.5 - 8}
            y={-10}
            width={tr.trigger.length * 7 + 16}
            height={20}
            rx={6}
            fill="rgba(3,3,10,0.8)"
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={3.5}
            fontSize={8}
            fill="rgba(165,180,252,0.8)"
            textAnchor="middle"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            {tr.trigger.toUpperCase()}
          </text>
        </g>
      )}

      {/* Clickable hit area */}
      <path
        d={line}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          toggleBidirectional(tr.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteTransition(tr.id);
        }}
      />

      {/* Bidirectional indicator */}
      {tr.bidirectional && midX !== undefined && midY !== undefined && (
        <circle cx={midX} cy={midY - 16} r={4} fill="rgba(167,139,250,0.8)" />
      )}
    </g>
  );
}
