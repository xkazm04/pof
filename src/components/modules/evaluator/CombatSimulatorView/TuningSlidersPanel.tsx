import { Activity } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CenterSlider } from '@/components/ui/CenterSlider';
import { MetricLabel } from '@/components/ui/MetricLabel';
import type { TuningOverrides } from '@/types/combat-simulator';
import { TUNING_SLIDERS } from './constants';

// ── Tuning Sliders ──────────────────────────────────────────────────────────

export function TuningSlidersPanel({
  tuning, defaultTuning, setTuning, handleTuningChange,
}: {
  tuning: TuningOverrides;
  defaultTuning: TuningOverrides | null;
  setTuning: (t: TuningOverrides) => void;
  handleTuningChange: (key: keyof TuningOverrides, value: number) => void;
}) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Tuning Sliders</h2>
        <button
          onClick={() => defaultTuning && setTuning({ ...defaultTuning })}
          className="ml-auto text-2xs text-text-muted hover:text-text transition-colors"
        >
          Reset
        </button>
      </div>
      <div className="space-y-2.5">
        {TUNING_SLIDERS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center gap-2">
            <Icon className="w-3 h-3 text-text-muted flex-shrink-0" />
            <MetricLabel
              metricId={key}
              label={label}
              className="text-2xs text-text-muted w-20 flex-shrink-0"
            />
            <CenterSlider
              className="flex-1"
              value={Math.round(tuning[key] * 100)}
              min={50}
              max={200}
              neutral={100}
              onChange={(v) => handleTuningChange(key, v / 100)}
              ariaLabel={`${label} multiplier`}
            />
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
