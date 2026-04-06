'use client';

import { useState } from 'react';
import { Scaling } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_VIOLET, OPACITY_5, OPACITY_12, OPACITY_25, GLOW_MD, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../design';
import { SCALING_PROPS } from '../data';

export function CharacterScalingPreview() {
  const [scalingLevel, setScalingLevel] = useState(1);
  const scalingT = (scalingLevel - 1) / 49;

  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Scaling} label="Character Scaling" color={ACCENT_VIOLET} />

      {/* Level selector */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Level</span>
        <input
          type="range" min={1} max={50} value={scalingLevel}
          onChange={(e) => setScalingLevel(Number(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: ACCENT_VIOLET }}
        />
        <motion.span
          key={scalingLevel}
          initial={{ scale: 1.3, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-lg font-mono font-bold min-w-[36px] text-center tabular-nums"
          style={{ color: ACCENT_VIOLET, textShadow: `0 0 12px ${withOpacity(ACCENT_VIOLET, OPACITY_25)}` }}
        >
          {scalingLevel}
        </motion.span>
      </div>

      {/* Scaling properties grid */}
      <div className="grid grid-cols-2 gap-3">
        {SCALING_PROPS.map((prop, i) => {
          const val = prop.min + (prop.max - prop.min) * scalingT;
          const pct = ((val - prop.min) / (prop.max - prop.min)) * 100;
          return (
            <motion.div
              key={prop.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="p-3 rounded-lg border relative overflow-hidden group"
              style={{ borderColor: withOpacity(prop.color, OPACITY_12), backgroundColor: withOpacity(prop.color, OPACITY_5) }}
            >
              {/* Hover glow */}
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ backgroundColor: withOpacity(prop.color, OPACITY_12) }} />

              <div className="flex justify-between items-center mb-2 relative z-[1]">
                <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">{prop.label}</span>
                <motion.span
                  key={val.toFixed(prop.unit === 'x' ? 2 : 0)}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className="text-sm font-mono font-bold tabular-nums"
                  style={{ color: prop.color, textShadow: `${GLOW_MD} ${withOpacity(prop.color, OPACITY_25)}` }}
                >
                  {val.toFixed(prop.unit === 'x' ? 2 : 0)}
                  <span className="text-[9px] ml-0.5 text-text-muted">{prop.unit}</span>
                </motion.span>
              </div>

              <NeonBar pct={pct} color={prop.color} glow />

              <div className="flex justify-between text-[9px] font-mono text-text-muted mt-1.5 relative z-[1]">
                <span>{prop.min}{prop.unit}</span>
                <span>{prop.max}{prop.unit}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
