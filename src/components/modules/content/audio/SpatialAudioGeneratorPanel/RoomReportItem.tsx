'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, ChevronDown, ChevronRight, Music, Radio,
} from 'lucide-react';
import type { RoomAudioReport } from '@/lib/spatial-audio-generator';
import {
  ACCENT_VIOLET, STATUS_INFO, STATUS_NEUTRAL,
  withOpacity, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { ROOM_TYPE_COLORS } from './constants';
import { PropPill } from './PropPill';

export function RoomReportItem({
  room,
  isExpanded,
  onToggle,
  prefersReduced,
  accent,
}: {
  room: RoomAudioReport;
  isExpanded: boolean;
  onToggle: () => void;
  prefersReduced: boolean | null;
  accent: string;
}) {
  const ACCENT = accent;
  return (
    <div key={room.roomId} className="rounded-xl border border-border bg-surface-deep overflow-hidden transition-colors hover:border-border-bright">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-xs text-left transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: ROOM_TYPE_COLORS[room.roomType] ?? STATUS_NEUTRAL }}
        />
        <span className="text-text font-semibold flex-1 truncate">{room.roomName}</span>
        <span className="text-2xs font-mono text-text-muted flex-shrink-0 text-right">
          {room.reverbPreset} <br /> {room.emitterCount} source(s)
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border bg-surface">
              {/* Reasoning */}
              <div className="p-3 rounded-lg bg-surface-deep border border-border">
                <p className="text-xs font-mono text-text-muted-hover leading-relaxed">
                  <span className="text-text font-semibold">Reasoning: </span>{room.reasoning}
                </p>
              </div>

              {/* Acoustic props */}
              <div className="flex flex-wrap gap-2">
                <PropPill icon={Volume2} label="Reverb" value={room.reverbPreset} color={ACCENT_VIOLET} />
                <PropPill icon={Radio} label="Occlusion" value={room.occlusionMode} color={STATUS_INFO} />
              </div>

              {/* Emitters */}
              {room.emitterNames.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold text-text-muted">Generated emitters</span>
                  <div className="flex flex-wrap gap-2">
                    {room.emitterNames.map((name, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg text-2xs font-mono border flex items-center gap-1.5"
                        style={{
                          color: ACCENT,
                          borderColor: withOpacity(ACCENT, OPACITY_20),
                          backgroundColor: withOpacity(ACCENT, OPACITY_10),
                        }}
                      >
                        <Music className="w-3 h-3" style={{ color: ACCENT }} />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
