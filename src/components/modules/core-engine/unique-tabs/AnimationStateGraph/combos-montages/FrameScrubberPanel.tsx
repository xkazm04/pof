'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, ChevronDown } from 'lucide-react';
import { OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_25, OPACITY_37 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, SCRUBBER_LANES, SCRUBBER_TOTAL_FRAMES, ALL_MONTAGES, MONTAGE_CATEGORIES, type MontageCategory, type MontageEntry } from '../data';

/** Group montages by category for dropdown. */
const GROUPED_MONTAGES: { category: MontageCategory; montages: MontageEntry[] }[] =
  MONTAGE_CATEGORIES.map(cat => ({
    category: cat,
    montages: ALL_MONTAGES.filter(m => m.category === cat),
  })).filter(g => g.montages.length > 0);

export function FrameScrubberPanel() {
  const [selectedMontageId, setSelectedMontageId] = useState(ALL_MONTAGES[0].id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrubberFrame, setScrubberFrame] = useState(0);
  const [scrubberPlaying, setScrubberPlaying] = useState(false);
  const scrubberRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedMontage = useMemo(
    () => ALL_MONTAGES.find(m => m.id === selectedMontageId) ?? ALL_MONTAGES[0],
    [selectedMontageId],
  );

  const totalFrames = selectedMontage.totalFrames;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Use a ref to track whether we should stop, avoiding nested setState
  const shouldStopRef = useRef(false);

  useEffect(() => {
    if (!scrubberPlaying) return;
    shouldStopRef.current = false;
    scrubberRef.current = setInterval(() => {
      setScrubberFrame((f) => {
        if (f >= totalFrames) { shouldStopRef.current = true; return 0; }
        return f + 1;
      });
      if (shouldStopRef.current) setScrubberPlaying(false);
    }, 80);
    return () => { if (scrubberRef.current) clearInterval(scrubberRef.current); };
  }, [scrubberPlaying, totalFrames]);

  const handleSelectMontage = useCallback((id: string) => {
    setSelectedMontageId(id);
    setScrubberFrame(0);
    setScrubberPlaying(false);
    setDropdownOpen(false);
  }, []);

  // Scale scrubber lanes to the selected montage's frame count
  const scaledLanes = useMemo(() => SCRUBBER_LANES.map(lane => ({
    ...lane,
    startFrame: Math.round((lane.startFrame / SCRUBBER_TOTAL_FRAMES) * totalFrames),
    endFrame: Math.round((lane.endFrame / SCRUBBER_TOTAL_FRAMES) * totalFrames),
  })), [totalFrames]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Montage Frame Scrubber" color={ACCENT} />
      <div className="mt-3">
        {/* Montage selector dropdown */}
        <div className="relative mb-3" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-xs font-mono border transition-colors cursor-pointer hover:bg-surface-hover"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_25) }}
          >
            <span className="font-bold text-text">{selectedMontage.name}</span>
            <span className="text-text-muted">{selectedMontage.category} &middot; {totalFrames}f @ {selectedMontage.fps}fps</span>
            <ChevronDown className="w-3 h-3 text-text-muted ml-auto transition-transform" style={{ transform: dropdownOpen ? 'rotate(180deg)' : undefined }} />
          </button>

          {dropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border bg-surface shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar"
              style={{ borderColor: withOpacity(ACCENT, OPACITY_25) }}>
              {GROUPED_MONTAGES.map(({ category, montages }) => (
                <div key={category}>
                  <div className="px-3 py-1 text-xs font-mono uppercase tracking-wider text-text-muted bg-surface-deep sticky top-0"
                    style={{ borderBottom: `1px solid ${withOpacity(ACCENT, OPACITY_12)}` }}>
                    {category} ({montages.length})
                  </div>
                  {montages.map(mon => {
                    const active = mon.id === selectedMontageId;
                    return (
                      <button
                        key={mon.id}
                        onClick={() => handleSelectMontage(mon.id)}
                        className="w-full text-left px-3 py-1 text-xs font-mono hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-2"
                        style={active ? { backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT } : undefined}
                      >
                        <span className="font-medium text-text">{mon.name}</span>
                        <span className="text-text-muted ml-auto">{mon.totalFrames}f</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => {
              if (scrubberPlaying) { setScrubberPlaying(false); }
              else { if (scrubberFrame >= totalFrames) setScrubberFrame(0); setScrubberPlaying(true); }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: withOpacity(ACCENT, OPACITY_12), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}
          >
            <Play className="w-3 h-3" />
            {scrubberPlaying ? 'Pause' : 'Play'}
          </button>
          <span className="text-xs font-mono text-text">
            Frame <span className="font-bold" style={{ color: ACCENT }}>{scrubberFrame}</span>
            <span className="text-text-muted"> / {totalFrames}</span>
          </span>
          {selectedMontage.hasRootMotion && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT }}>
              Root Motion
            </span>
          )}
        </div>

        {/* Scrubber bar */}
        <div className="relative mb-4">
          <input
            type="range"
            min={0}
            max={totalFrames}
            value={scrubberFrame}
            onChange={(e) => { setScrubberFrame(Number(e.target.value)); setScrubberPlaying(false); }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: ACCENT, background: `linear-gradient(to right, ${withOpacity(ACCENT, OPACITY_25)} ${(scrubberFrame / totalFrames) * 100}%, ${withOpacity(OVERLAY_WHITE, OPACITY_5)} ${(scrubberFrame / totalFrames) * 100}%)` }}
          />
        </div>

        {/* Notify lanes */}
        <div className="space-y-1.5">
          {scaledLanes.map((lane) => (
            <div key={lane.name} className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-text-muted w-20 truncate">{lane.name}</span>
              <div className="flex-1 relative h-5 rounded bg-surface-deep">
                <div
                  className="absolute top-0 h-full rounded opacity-70"
                  style={{
                    left: `${(lane.startFrame / totalFrames) * 100}%`,
                    width: `${((lane.endFrame - lane.startFrame) / totalFrames) * 100}%`,
                    backgroundColor: withOpacity(lane.color, OPACITY_37),
                    borderLeft: `2px solid ${lane.color}`,
                  }}
                />
                {/* Current frame marker */}
                <div
                  className="absolute top-0 w-[2px] h-full bg-white/60 z-10"
                  style={{ left: `${(scrubberFrame / totalFrames) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
