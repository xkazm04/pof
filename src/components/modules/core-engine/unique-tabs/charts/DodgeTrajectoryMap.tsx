'use client';

export interface Trajectory {
  id: number | string;
  path: string;
  color: string;
}

interface DodgeTrajectoryMapProps {
  trajectories: Trajectory[];
  originColor: string;
  size?: number;
}

export function DodgeTrajectoryMap({
  trajectories,
  originColor,
  size = 100,
}: DodgeTrajectoryMapProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="overflow-visible">
      {/* Grid */}
      <rect x={0} y={0} width={100} height={100} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" rx={4} />
      {[25, 50, 75].map((v) => (
        <g key={v}>
          <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        </g>
      ))}
      {/* Player origin */}
      <circle cx={50} cy={80} r={4} fill={originColor} style={{ filter: `drop-shadow(0 0 4px ${originColor})` }} />
      <text x={50} y={93} textAnchor="middle" className="text-[6px] font-mono font-bold fill-[var(--text-muted)]">Start</text>
      {/* Trajectories */}
      {trajectories.map((traj) => (
        <path
          key={traj.id}
          d={traj.path}
          fill="none"
          stroke={traj.color}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.8}
          style={{ filter: `drop-shadow(0 0 3px ${traj.color}60)` }}
        />
      ))}
    </svg>
  );
}
