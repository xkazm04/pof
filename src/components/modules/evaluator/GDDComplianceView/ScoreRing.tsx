import { scoreColor } from './helpers';

export function ScoreRing({ score, size }: { score: number; size: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Compliance score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-slow"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}
