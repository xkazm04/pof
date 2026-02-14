'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useNavigationStore } from '@/stores/navigationStore';
import { useModuleStore } from '@/stores/moduleStore';
import { getSubModulesForCategory, SUB_MODULE_MAP, CATEGORY_MAP } from '@/lib/module-registry';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { SubModuleId } from '@/types/modules';

const RING_SIZE = 16;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function SidebarL2() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const setActiveSubModule = useNavigationStore((s) => s.setActiveSubModule);

  const category = activeCategory ? CATEGORY_MAP[activeCategory] : null;
  const subModules = activeCategory ? getSubModulesForCategory(activeCategory) : [];

  return (
    <AnimatePresence mode="wait">
      {category && subModules.length > 0 && (
        <motion.div
          key={activeCategory}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 180, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full border-r border-border bg-surface-deep overflow-hidden"
        >
          <div className="w-[180px] flex flex-col h-full">
            <div className="px-3 py-3 border-b border-border">
              <h2
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: category.accentColor }}
              >
                {category.label}
              </h2>
            </div>
            <StaggerContainer className="flex-1 overflow-y-auto py-2">
              {subModules.map((mod) => {
                const isActive = activeSubModule === mod.id;
                const Icon = mod.icon;
                return (
                  <StaggerItem key={mod.id}>
                  <button
                    onClick={() => setActiveSubModule(mod.id)}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150
                      ${isActive
                        ? 'bg-surface-hover'
                        : 'hover:bg-surface'
                      }
                    `}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: isActive ? category.accentColor : 'var(--text-muted)' }}
                    />
                    <span className={`text-xs truncate ${isActive ? 'text-text' : 'text-text-muted'}`}>
                      {mod.label}
                    </span>
                    <ProgressRing
                      moduleId={mod.id}
                      accentColor={category.accentColor}
                    />
                  </button>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Progress Ring ───────────────────────────────────────────────────────────

const ProgressRing = memo(function ProgressRing({
  moduleId,
  accentColor,
}: {
  moduleId: SubModuleId;
  accentColor: string;
}) {
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);
  const mod = SUB_MODULE_MAP[moduleId];
  const total = mod?.checklist?.length ?? 0;

  // No checklist → no ring, show nothing
  if (total === 0) return null;

  const completed = progress
    ? Object.values(progress).filter(Boolean).length
    : 0;
  const pct = Math.min(completed / total, 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct);

  // 100% complete → checkmark
  if (pct >= 1) {
    return (
      <div
        className="ml-auto flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <Check className="w-2.5 h-2.5" style={{ color: accentColor }} strokeWidth={3} />
      </div>
    );
  }

  return (
    <svg
      className="ml-auto flex-shrink-0"
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth={RING_STROKE}
      />
      {/* Fill */}
      {pct > 0 && (
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={accentColor}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      )}
    </svg>
  );
});
