'use client';

import { Crosshair } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE, OPACITY_5, OPACITY_15, withOpacity, GLOW_SM } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../design';
import { DodgeTrajectoryMap } from '../../charts';
import { ACCENT, DODGE_TRAJECTORIES } from '../data';

export function DodgeTrajectorySection() {
  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Crosshair} label="Dodge Trajectories" color={ACCENT_CYAN} />

      <div className="flex items-start gap-5">
        {/* Trajectory visualization */}
        <DodgeTrajectoryMap trajectories={DODGE_TRAJECTORIES} originColor={ACCENT} />

        <div className="flex-1 space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <GlowStat label="Avg Distance" value="250" unit="cm" color={ACCENT_CYAN} delay={0} />
            <GlowStat label="Avg Duration" value="0.3" unit="s" color={ACCENT_EMERALD} delay={0.06} />
            <GlowStat label="Trajectories" value="5" unit="" color={ACCENT_VIOLET} delay={0.12} />
            <GlowStat label="I-Frames" value="0.15" unit="s" color={ACCENT_ORANGE} delay={0.18} />
          </div>

          {/* Trajectory legend */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/15">
            {DODGE_TRAJECTORIES.map((traj, i) => (
              <motion.span
                key={traj.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 + 0.2 }}
                className="flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded border"
                style={{
                  color: traj.color,
                  borderColor: withOpacity(traj.color, OPACITY_15),
                  backgroundColor: withOpacity(traj.color, OPACITY_5),
                }}
              >
                <span className="w-3 h-px rounded-full" style={{ backgroundColor: traj.color, boxShadow: `${GLOW_SM} ${traj.color}` }} />
                #{traj.id}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
