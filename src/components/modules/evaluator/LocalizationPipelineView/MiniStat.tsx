import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SCALE } from './constants';

export function MiniStat({ label, value, accentColor }: { label: string; value: number | string; accentColor?: string }) {
  return (
    <SurfaceCard level={2} className="min-w-0">
      <p className={`${SCALE.meta} truncate`}>{label}</p>
      <p
        className={`text-lg font-bold truncate ${accentColor ? '' : 'text-text'}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </p>
    </SurfaceCard>
  );
}
