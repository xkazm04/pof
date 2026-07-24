import { ParamCue } from '@/components/modules/evaluator/ParamCue';
import type { ParamDef, SurfaceDef } from './types';

interface ParametersSectionProps {
  applicableParams: ParamDef[];
  paramValues: Record<string, number>;
  explainMode: boolean;
  surfaceDef: SurfaceDef;
  setParam: (name: string, value: number) => void;
}

export function ParametersSection({ applicableParams, paramValues, explainMode, surfaceDef, setParam }: ParametersSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">
        Parameters
        <span className="ml-1.5 font-normal normal-case text-text-muted">({applicableParams.length} for {surfaceDef.label})</span>
      </h4>
      <div className="space-y-3">
        {applicableParams.map((p) => {
          const val = paramValues[p.name] ?? p.defaultValue;
          const normalized = (val - p.min) / (p.max - p.min || 1);
          const display = val.toFixed(p.step < 1 ? 2 : 0);
          // Screen readers otherwise hear a bare number with no scale or unit —
          // mirror what the visible min/max captions say under the track.
          const valueText = explainMode
            ? `${display} — ${p.plain.lowLabel} (${p.min}) to ${p.plain.highLabel} (${p.max})`
            : `${display} of ${p.min} to ${p.max}`;
          return (
            <div
              key={p.name}
              className="px-3 py-2 rounded-lg bg-surface-deep border border-border"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {explainMode && (
                    <ParamCue
                      kind={p.plain.cue}
                      value={normalized}
                      accent={surfaceDef.color}
                      title={`${p.plain.label}: ${p.plain.explanation}`}
                    />
                  )}
                  <span className="text-2xs font-medium text-[#c0c4e0]" title={`UE: ${p.name}`}>
                    {explainMode ? p.plain.label : p.label}
                  </span>
                </div>
                <span className="text-2xs font-mono text-[#9b9ec0]">{display}</span>
              </div>
              {explainMode && (
                <p className="text-2xs text-text-muted/70 mb-1.5">{p.plain.explanation}</p>
              )}
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={val}
                onChange={(e) => setParam(p.name, parseFloat(e.target.value))}
                aria-label={`${explainMode ? p.plain.label : p.label} (UE parameter ${p.name})`}
                aria-valuetext={valueText}
                className="focus-ring w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${surfaceDef.color} 0%, ${surfaceDef.color} ${normalized * 100}%, var(--border) ${normalized * 100}%, var(--border) 100%)`,
                }}
              />
              <div className="flex justify-between mt-0.5">
                <span className="text-2xs text-[#3a3e5a]">{explainMode ? p.plain.lowLabel : p.min}</span>
                <span className="text-2xs text-[#3a3e5a]">{explainMode ? p.plain.highLabel : p.max}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
