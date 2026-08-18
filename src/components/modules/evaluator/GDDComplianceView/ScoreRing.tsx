import { scoreColor } from './helpers';

/**
 * Compliance score ring. `measured={false}` is a first-class state, not a zero:
 * the arc stays empty, the centre reads "—", and the accessible name says the
 * module was never evaluated — so an unmeasured module can never be mistaken for
 * a measured low score (or, as before this change, for a filled 70).
 *
 * Not `ui/ScoreRing`: that primitive hardcodes a three-band 70/40 colour ladder,
 * has no unmeasured state, and offers no accessible-name override (its label is
 * the generic "Score: N out of 100"). This ring uses the canonical four-band
 * `scoreBandToken` via `scoreColor`. See the build record for the reconciliation
 * note.
 */
export function ScoreRing({ score, size, measured = true }: {
  score: number;
  size: number;
  measured?: boolean;
}) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = measured ? (score / 100) * circumference : 0;
  const color = measured ? scoreColor(score) : 'var(--text-subtle)';

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        measured
          ? `Compliance score ${score} out of 100`
          : 'Compliance score unmeasured — no evidence'
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
          strokeDasharray={measured ? undefined : '3 4'}
        />
        {measured && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-slow"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {measured ? score : '—'}
        </span>
      </div>
    </div>
  );
}
