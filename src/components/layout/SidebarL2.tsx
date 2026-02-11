'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { getSubModulesForCategory, CATEGORY_MAP } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

export function SidebarL2() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const setActiveSubModule = useNavigationStore((s) => s.setActiveSubModule);
  const moduleHealth = useModuleStore((s) => s.moduleHealth);
  const gameGenre = useProjectStore((s) => s.gameGenre);

  const category = activeCategory ? CATEGORY_MAP[activeCategory] : null;
  const subModules = activeCategory ? getSubModulesForCategory(activeCategory, gameGenre) : [];

  const getStatusColor = (moduleId: SubModuleId) => {
    const health = moduleHealth[moduleId];
    if (!health || health.status === 'not-started') return '#2e2e5a';
    if (health.status === 'healthy') return '#00ff88';
    if (health.status === 'in-progress') return '#f59e0b';
    return '#ef4444';
  };

  const showNoGenreHint = activeCategory === 'core-engine' && subModules.length === 0;

  return (
    <AnimatePresence mode="wait">
      {category && (subModules.length > 0 || showNoGenreHint) && (
        <motion.div
          key={activeCategory}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 180, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full border-r border-[#1e1e3a] bg-[#0d0d22] overflow-hidden"
        >
          <div className="w-[180px] flex flex-col h-full">
            <div className="px-3 py-3 border-b border-[#1e1e3a]">
              <h2
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: category.accentColor }}
              >
                {category.label}
              </h2>
            </div>
            {showNoGenreHint ? (
              <div className="flex-1 flex items-center justify-center px-4">
                <p className="text-[11px] text-[#6b7294] text-center leading-relaxed">
                  Select a game genre in Project Setup to see your development roadmap.
                </p>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto py-2">
              {subModules.map((mod) => {
                const isActive = activeSubModule === mod.id;
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveSubModule(mod.id)}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150
                      ${isActive
                        ? 'bg-[#1a1a3a]'
                        : 'hover:bg-[#111128]'
                      }
                    `}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: isActive ? category.accentColor : '#6b7294' }}
                    />
                    <span className={`text-xs truncate ${isActive ? 'text-[#e0e4f0]' : 'text-[#6b7294]'}`}>
                      {mod.label}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full ml-auto flex-shrink-0"
                      style={{ backgroundColor: getStatusColor(mod.id) }}
                    />
                  </button>
                );
              })}
            </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
