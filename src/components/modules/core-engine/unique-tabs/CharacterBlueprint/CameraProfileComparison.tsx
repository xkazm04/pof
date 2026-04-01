'use client';

import { Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import { RadarChart } from '../_shared';
import { BlueprintPanel, SectionHeader } from './design';
import { CAMERA_PROFILES } from './data';

export function CameraProfileComparison() {
  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Camera} label="Camera Profiles" color={ACCENT_ORANGE} />

      <div className="flex items-center gap-5 justify-center">
        <RadarChart
          data={CAMERA_PROFILES[0].data}
          size={200}
          accent={CAMERA_PROFILES[0].color}
          overlays={CAMERA_PROFILES.slice(1)}
          showLabels
        />

        <div className="flex flex-col gap-3">
          {/* Profile legend cards */}
          {CAMERA_PROFILES.map((profile, i) => (
            <motion.div
              key={profile.label}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border group"
              style={{
                borderColor: `${profile.color}25`,
                backgroundColor: `${profile.color}06`,
              }}
            >
              <span className="w-2 h-6 rounded-full flex-shrink-0 transition-all group-hover:h-8"
                style={{
                  backgroundColor: profile.color,
                  boxShadow: `0 0 8px ${profile.color}40`,
                }} />
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: profile.color }}>{profile.label}</div>
                <div className="text-xs font-mono text-text-muted mt-0.5">
                  Peak: {profile.data.reduce((best, d) => d.value > best.value ? d : best, profile.data[0]).axis}
                  {' '}({(profile.data.reduce((best, d) => d.value > best.value ? d : best, profile.data[0]).value * 100).toFixed(0)}%)
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
