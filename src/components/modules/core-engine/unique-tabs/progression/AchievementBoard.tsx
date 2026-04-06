'use client';

import {
  Swords, Compass, Hammer, TrendingUp, Trophy, Star,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_EMERALD, ACCENT_ORANGE, OVERLAY_WHITE,
  withOpacity, OPACITY_6,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../_shared';
import { ACCENT } from './progression-data';

const ACHIEVEMENT_CATEGORIES = [
  {
    category: 'Combat', color: STATUS_ERROR, icon: Swords,
    achievements: [
      { name: 'First Blood', progress: 100, desc: 'Defeat your first enemy' },
      { name: 'Slayer', progress: 73, desc: 'Defeat 100 enemies' },
      { name: 'Boss Hunter', progress: 40, desc: 'Defeat 10 bosses' },
      { name: 'Untouchable', progress: 15, desc: 'Dodge 500 attacks' },
    ],
  },
  {
    category: 'Exploration', color: ACCENT_EMERALD, icon: Compass,
    achievements: [
      { name: 'Wanderer', progress: 100, desc: 'Visit 5 zones' },
      { name: 'Cartographer', progress: 60, desc: 'Reveal entire map' },
      { name: 'Secret Finder', progress: 25, desc: 'Find 20 hidden areas' },
      { name: 'Treasure Hunter', progress: 50, desc: 'Open 50 chests' },
    ],
  },
  {
    category: 'Crafting', color: ACCENT_ORANGE, icon: Hammer,
    achievements: [
      { name: 'Apprentice', progress: 100, desc: 'Craft your first item' },
      { name: 'Blacksmith', progress: 45, desc: 'Craft 50 weapons' },
      { name: 'Enchanter', progress: 20, desc: 'Enchant 25 items' },
      { name: 'Master Crafter', progress: 10, desc: 'Craft a legendary' },
    ],
  },
  {
    category: 'Progression', color: STATUS_WARNING, icon: TrendingUp,
    achievements: [
      { name: 'Level 10', progress: 100, desc: 'Reach level 10' },
      { name: 'Level 25', progress: 80, desc: 'Reach level 25' },
      { name: 'Level 50', progress: 30, desc: 'Reach level 50' },
      { name: 'Prestige', progress: 0, desc: 'Complete a prestige cycle' },
    ],
  },
];

export function AchievementBoard() {
  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden">
      <SectionLabel icon={Trophy} label="Achievement Board" color={ACCENT} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2.5">
        {ACHIEVEMENT_CATEGORIES.map((cat, ci) => {
          const Icon = cat.icon;
          const catPct = Math.round(cat.achievements.reduce((s, a) => s + a.progress, 0) / cat.achievements.length);

          return (
            <motion.div
              key={cat.category}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                  <span className="text-xs font-bold text-text">{cat.category}</span>
                </div>
                <span className="text-2xs font-mono font-bold" style={{ color: cat.color }}>{catPct}%</span>
              </div>

              <div className="h-1.5 bg-surface-deep rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${catPct}%` }} transition={{ duration: 0.8, delay: ci * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              </div>

              <div className="space-y-3">
                {cat.achievements.map((ach, ai) => (
                  <motion.div
                    key={ach.name}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ci * 0.1 + ai * 0.05 }}
                    className="flex items-center gap-2 group/ach"
                  >
                    <div className="relative flex-shrink-0" style={{ width: 28, height: 28 }}>
                      <svg width={28} height={28} viewBox="0 0 28 28">
                        <circle cx="14" cy="14" r="11" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth="2.5" />
                        <circle
                          cx="14" cy="14" r="11" fill="none"
                          stroke={ach.progress === 100 ? STATUS_SUCCESS : cat.color}
                          strokeWidth="2.5"
                          strokeDasharray={`${2 * Math.PI * 11}`}
                          strokeDashoffset={`${2 * Math.PI * 11 * (1 - ach.progress / 100)}`}
                          strokeLinecap="round"
                          transform="rotate(-90 14 14)"
                          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                        />
                      </svg>
                      {ach.progress === 100 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Star className="w-2.5 h-2.5" style={{ color: STATUS_WARNING }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-2xs font-bold text-text truncate group-hover/ach:text-amber-400 transition-colors">{ach.name}</div>
                      <div className="text-xs text-text-muted truncate">{ach.desc}</div>
                    </div>
                    <span className="text-2xs font-mono font-bold flex-shrink-0" style={{ color: ach.progress === 100 ? STATUS_SUCCESS : 'var(--text-muted)' }}>
                      {ach.progress}%
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
