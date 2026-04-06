'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_20, OPACITY_30,
  withOpacity, OPACITY_50, OPACITY_37,
} from '@/lib/chart-colors';
import { ACCENT, BEACON_CONFIGS } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';

/* eslint-disable no-restricted-syntax -- accessibility-specific colors for colorblind mode, no semantic token equivalent */
const COLORBLIND_MAP: Record<string, string> = {
  Common: '#888888', Uncommon: '#4488ff', Rare: '#ff8844', Epic: '#ff44ff', Legendary: '#ffff44',
};
/* eslint-enable no-restricted-syntax */

export function BeaconVisualizer() {
  const [colorblindMode, setColorblindMode] = useState(false);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Radio} label="World Drop Beacon Config" color={ACCENT} />
        <button onClick={() => setColorblindMode((v) => !v)}
          className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer"
          style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT, backgroundColor: colorblindMode ? withOpacity(ACCENT, OPACITY_20) : 'transparent' }}>
          {colorblindMode ? 'CB Mode ON' : 'Colorblind'}
        </button>
      </div>
      {/* Config grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-2xs font-mono">
          <thead>
            <tr className="text-text-muted border-b border-border/30">
              <th className="text-left py-1 pr-2">Rarity</th>
              <th className="text-center py-1 px-2">Color</th>
              <th className="text-center py-1 px-2">Beam Height</th>
              <th className="text-center py-1 px-2">Pulse Speed</th>
              <th className="text-center py-1 px-2">Pickup Radius</th>
            </tr>
          </thead>
          <tbody>
            {BEACON_CONFIGS.map((cfg) => {
              const displayColor = colorblindMode ? (COLORBLIND_MAP[cfg.rarity] ?? cfg.color) : cfg.color;
              return (
                <tr key={cfg.rarity} className="border-t border-border/20">
                  <td className="py-1.5 pr-2" style={{ color: displayColor }}>{cfg.rarity}</td>
                  <td className="text-center py-1.5 px-2">
                    <span className="inline-block w-5 h-3 rounded-sm" style={{ backgroundColor: displayColor, boxShadow: `0 0 6px ${withOpacity(displayColor, OPACITY_50)}` }} />
                  </td>
                  <td className="text-center py-1.5 px-2 text-text">{cfg.beamHeight}m</td>
                  <td className="text-center py-1.5 px-2 text-text">{cfg.pulseSpeed > 0 ? `${cfg.pulseSpeed}x` : 'None'}</td>
                  <td className="text-center py-1.5 px-2 text-text">{cfg.pickupRadius}u</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Beam height preview */}
      <div className="mt-3">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Relative Beam Heights</div>
        <div className="flex items-end justify-center gap-4 h-28">
          {BEACON_CONFIGS.map((cfg) => {
            const displayColor = colorblindMode ? (COLORBLIND_MAP[cfg.rarity] ?? cfg.color) : cfg.color;
            return (
              <div key={cfg.rarity} className="flex flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }} animate={{ height: `${cfg.beamHeight}%` }}
                  transition={{ duration: 0.5, delay: BEACON_CONFIGS.indexOf(cfg) * 0.1 }}
                  className="w-3 rounded-t relative overflow-hidden"
                  style={{ backgroundColor: displayColor, boxShadow: `0 0 10px ${withOpacity(displayColor, OPACITY_37)}`, minHeight: cfg.beamHeight > 0 ? 4 : 0 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent"
                    animate={{ y: ['-100%', '100%'] }}
                    transition={{ duration: cfg.pulseSpeed > 0 ? 2 / cfg.pulseSpeed : 10, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
                <span className="text-xs font-mono text-text-muted">{cfg.rarity.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
