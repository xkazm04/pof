'use client';

import { useState, useMemo, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_ORANGE, OVERLAY_WHITE, OPACITY_4, OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_20, OPACITY_25, GLOW_MD, withOpacity } from '@/lib/chart-colors';
import { RadarChart } from '../../_shared';
import { BlueprintPanel, SectionHeader, CornerBrackets } from '../design';
import { CAMERA_PROFILES } from '../data';

/* ── Viewport Mockup ────────────────────────────────────────────────────── */

/** Visual viewport showing FOV cone, arm length, and lag zone for selected profile */
function ViewportMockup({ profile }: { profile: typeof CAMERA_PROFILES[number] }) {
  const fov = profile.data.find(d => d.axis === 'FOV')?.value ?? 0.5;
  const dist = profile.data.find(d => d.axis === 'Distance')?.value ?? 0.5;
  const smooth = profile.data.find(d => d.axis === 'Smoothness')?.value ?? 0.5;
  const responsive = profile.data.find(d => d.axis === 'Responsive')?.value ?? 0.5;

  const fovAngle = 40 + fov * 50; // 40-90 degrees half-angle visual
  const armLen = 30 + dist * 50; // visual arm length
  const lagRadius = 8 + (1 - responsive) * 18; // bigger = slower response

  return (
    <div className="relative rounded-lg border p-2 overflow-hidden"
      style={{ borderColor: withOpacity(profile.color, OPACITY_15), backgroundColor: withOpacity(profile.color, OPACITY_5) }}>
      <CornerBrackets color={profile.color} size={6} />
      <svg width="100%" viewBox="0 0 180 120" className="block">
        {/* Grid */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`g${i}`} x1={0} y1={i * 20} x2={180} y2={i * 20}
            stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth={0.5} />
        ))}

        {/* FOV Cone from camera position */}
        <path
          d={`M ${90 - armLen},20 L ${90 - fovAngle * 0.8},110 L ${90 + fovAngle * 0.8},110 Z`}
          fill={withOpacity(profile.color, OPACITY_8)}
          stroke={withOpacity(profile.color, OPACITY_20)}
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Camera arm line */}
        <line x1={90} y1={90} x2={90 - armLen} y2={20}
          stroke={profile.color} strokeWidth={1.5} strokeDasharray="3 3" />

        {/* Camera icon (small circle at arm end) */}
        <circle cx={90 - armLen} cy={20} r={4}
          fill={withOpacity(profile.color, OPACITY_15)}
          stroke={profile.color} strokeWidth={1.5} />
        <text x={90 - armLen} y={13} textAnchor="middle"
          className="text-[7px] font-mono" style={{ fill: profile.color }}>CAM</text>

        {/* Character marker */}
        <circle cx={90} cy={90} r={5}
          fill={withOpacity(profile.color, OPACITY_20)}
          stroke={profile.color} strokeWidth={1.5} />

        {/* Lag zone (dashed circle around character) */}
        <circle cx={90} cy={90} r={lagRadius}
          fill="none" stroke={withOpacity(profile.color, OPACITY_15)}
          strokeWidth={1} strokeDasharray="2 2" />
        <text x={90 + lagRadius + 3} y={90 + 3}
          className="text-[6px] font-mono" style={{ fill: 'var(--text-muted)' }}>lag</text>

        {/* Smoothness indicator (trailing dots behind camera) */}
        {Array.from({ length: Math.round(smooth * 5) }, (_, i) => (
          <circle key={i} cx={90 - armLen + (i + 1) * 4} cy={20 + (i + 1) * 2}
            r={1} fill={profile.color} opacity={0.5 - i * 0.08} />
        ))}

        {/* Labels */}
        <text x={4} y={12} className="text-[7px] font-mono uppercase" style={{ fill: profile.color }}>
          {profile.label}
        </text>
        <text x={4} y={115} className="text-[6px] font-mono" style={{ fill: 'var(--text-muted)' }}>
          FOV {(fov * 100).toFixed(0)}% | Arm {(dist * 100).toFixed(0)}% | Lag {((1 - responsive) * 100).toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}

export function CameraProfileComparison() {
  const [selected, setSelected] = useState<Set<number>>(() => new Set([0, 1, 2]));

  const toggleProfile = useCallback((index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) { if (next.size > 1) next.delete(index); }
      else next.add(index);
      return next;
    });
  }, []);

  const visible = useMemo(
    () => CAMERA_PROFILES.filter((_, i) => selected.has(i)),
    [selected],
  );

  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Camera} label="Camera Profiles" color={ACCENT_ORANGE} />

      <div className="space-y-4">
        <div className="flex items-center gap-5 justify-center">
          <RadarChart
            data={visible[0]?.data ?? []}
            size={200}
            accent={visible[0]?.color ?? ACCENT_ORANGE}
            overlays={visible.slice(1)}
            showLabels
          />

          <div className="flex flex-col gap-2">
            {/* Profile toggle cards */}
            {CAMERA_PROFILES.map((profile, i) => {
              const active = selected.has(i);
              const peak = profile.data.reduce((best, d) => d.value > best.value ? d : best, profile.data[0]);
              return (
                <motion.button
                  key={profile.label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  onClick={() => toggleProfile(i)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md border group cursor-pointer transition-all"
                  style={active ? {
                    borderColor: withOpacity(profile.color, OPACITY_15),
                    backgroundColor: withOpacity(profile.color, OPACITY_5),
                  } : {
                    borderColor: 'var(--border)',
                    backgroundColor: 'transparent',
                    opacity: 0.4,
                  }}
                >
                  <span className="w-2 h-6 rounded-full flex-shrink-0 transition-all group-hover:h-8"
                    style={{
                      backgroundColor: active ? profile.color : 'var(--text-muted)',
                      boxShadow: active ? `${GLOW_MD} ${withOpacity(profile.color, OPACITY_25)}` : 'none',
                    }} />
                  <div className="text-left">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider"
                      style={{ color: active ? profile.color : 'var(--text-muted)' }}>{profile.label}</div>
                    <div className="text-xs font-mono text-text-muted mt-0.5">
                      Peak: {peak.axis} ({(peak.value * 100).toFixed(0)}%)
                    </div>
                  </div>
                </motion.button>
              );
            })}
            <div className="text-[9px] font-mono text-text-muted text-center mt-1">
              {selected.size} / {CAMERA_PROFILES.length} profiles
            </div>
          </div>
        </div>

        {/* Viewport Mockups — visual FOV cone, arm length, lag zone */}
        {visible.length > 0 && (
          <div className={`grid gap-3 ${visible.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : visible.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {visible.map(p => <ViewportMockup key={p.label} profile={p} />)}
          </div>
        )}
      </div>
    </BlueprintPanel>
  );
}
