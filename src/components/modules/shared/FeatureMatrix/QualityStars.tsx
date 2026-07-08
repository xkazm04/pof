import { Star } from 'lucide-react';
import { STAR_COLORS } from './constants';

export function QualityStars({ score }: { score: number | null }) {
  if (score === null || score === 0) return null;
  const clamped = Math.min(5, Math.max(1, score));
  const color = STAR_COLORS[clamped];

  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <span className="flex items-center gap-px">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className="w-3 h-3"
            style={{
              color: i < clamped ? color : 'var(--border)',
              fill: i < clamped ? color : 'none',
            }}
          />
        ))}
      </span>
      <span className="text-2xs text-text-muted-hover">{clamped}/5</span>
    </span>
  );
}
