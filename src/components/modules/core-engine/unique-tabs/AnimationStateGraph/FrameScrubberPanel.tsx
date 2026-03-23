'use client';

import { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, SCRUBBER_LANES, SCRUBBER_TOTAL_FRAMES } from './data';

export function FrameScrubberPanel() {
  const [scrubberFrame, setScrubberFrame] = useState(0);
  const [scrubberPlaying, setScrubberPlaying] = useState(false);
  const scrubberRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scrubberPlaying) {
      scrubberRef.current = setInterval(() => {
        setScrubberFrame((f) => {
          if (f >= SCRUBBER_TOTAL_FRAMES) { setScrubberPlaying(false); return 0; }
          return f + 1;
        });
      }, 80);
    }
    return () => { if (scrubberRef.current) clearInterval(scrubberRef.current); };
  }, [scrubberPlaying]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Montage Frame Scrubber" color={ACCENT} />
      <div className="mt-3">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => {
              if (scrubberPlaying) { setScrubberPlaying(false); }
              else { if (scrubberFrame >= SCRUBBER_TOTAL_FRAMES) setScrubberFrame(0); setScrubberPlaying(true); }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <Play className="w-3 h-3" />
            {scrubberPlaying ? 'Pause' : 'Play'}
          </button>
          <span className="text-xs font-mono text-text">
            Frame <span className="font-bold" style={{ color: ACCENT }}>{scrubberFrame}</span>
            <span className="text-text-muted"> / {SCRUBBER_TOTAL_FRAMES}</span>
          </span>
        </div>

        {/* Scrubber bar */}
        <div className="relative mb-4">
          <input
            type="range"
            min={0}
            max={SCRUBBER_TOTAL_FRAMES}
            value={scrubberFrame}
            onChange={(e) => { setScrubberFrame(Number(e.target.value)); setScrubberPlaying(false); }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: ACCENT, background: `linear-gradient(to right, ${ACCENT}40 ${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%, rgba(255,255,255,0.05) ${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%)` }}
          />
        </div>

        {/* Notify lanes */}
        <div className="space-y-1.5">
          {SCRUBBER_LANES.map((lane) => (
            <div key={lane.name} className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-text-muted w-20 truncate">{lane.name}</span>
              <div className="flex-1 relative h-5 rounded bg-surface-deep">
                <div
                  className="absolute top-0 h-full rounded opacity-70"
                  style={{
                    left: `${(lane.startFrame / SCRUBBER_TOTAL_FRAMES) * 100}%`,
                    width: `${((lane.endFrame - lane.startFrame) / SCRUBBER_TOTAL_FRAMES) * 100}%`,
                    backgroundColor: `${lane.color}60`,
                    borderLeft: `2px solid ${lane.color}`,
                  }}
                />
                {/* Current frame marker */}
                <div
                  className="absolute top-0 w-[2px] h-full bg-white/60 z-10"
                  style={{ left: `${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
