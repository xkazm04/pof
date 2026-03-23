'use client';

import { useMemo, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, FeatureGrid, LoadingSpinner } from '../_shared';
import { CharacterFeelOptimizer } from '../CharacterFeelOptimizer';
import { CharacterFeelPlayground } from '../CharacterFeelPlayground';
import { PredictiveBalanceSimulator } from '../PredictiveBalanceSimulator';
import type { SubModuleId } from '@/types/modules';
import {
  ACCENT, SUBTABS, CHARACTER_FEATURES, COMPARISON_CHARACTERS,
  computeBalanceScores, type BlueprintSubtab,
} from './data';
import { BlueprintPanel, SectionHeader } from './design';
import { ClassHierarchy } from './ClassHierarchy';
import { CameraProfileComparison } from './CameraProfileComparison';
import { CharacterScalingPreview } from './CharacterScalingPreview';
import { HitboxWireframeViewer } from './HitboxWireframeViewer';
import { PropertyInspector } from './PropertyInspector';
import { InputBindingsTable } from './InputBindingsTable';
import { KeyboardVisualization } from './KeyboardVisualization';
import { MovementOverview } from './MovementOverview';
import { DodgeTrajectorySection } from './DodgeTrajectorySection';
import { ComparisonMatrix } from './ComparisonMatrix';
import { ArchetypeBalanceRadar } from './ArchetypeBalanceRadar';

interface CharacterBlueprintProps {
  moduleId: SubModuleId;
}

export function CharacterBlueprint({ moduleId }: CharacterBlueprintProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);

  const [activeTab, setActiveTab] = useState<BlueprintSubtab>('overview');
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(
    () => new Set(COMPARISON_CHARACTERS.map(c => c.name)),
  );
  const visibleCharacters = useMemo(
    () => COMPARISON_CHARACTERS.filter(c => selectedCharacters.has(c.name)),
    [selectedCharacters],
  );
  const toggleCharacter = useCallback((name: string) => {
    setSelectedCharacters(prev => {
      const next = new Set(prev);
      if (next.has(name)) { if (next.size > 1) next.delete(name); }
      else next.add(name);
      return next;
    });
  }, []);
  const balanceResults = useMemo(
    () => computeBalanceScores(visibleCharacters),
    [visibleCharacters],
  );
  const scoreMean = useMemo(() => {
    if (balanceResults.length === 0) return 0;
    return balanceResults.reduce((a, b) => a + b.compositeScore, 0) / balanceResults.length;
  }, [balanceResults]);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-5">
      <TabHeader icon={User} title="Character Blueprint" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Cockpit Mode Selector ──────────────────────────────────────────── */}
      <div className="relative rounded-xl border border-border/20 bg-surface-deep/80 p-1 backdrop-blur-sm">
        <div className="flex items-center gap-0.5">
          {SUBTABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-[0.15em] transition-colors duration-200 cursor-pointer"
                style={{ color: active ? ACCENT : 'var(--text-muted)' }}
              >
                {active && (
                  <motion.div
                    layoutId="blueprint-tab-glow"
                    className="absolute inset-0 rounded-lg border"
                    style={{
                      backgroundColor: `${ACCENT}10`,
                      borderColor: `${ACCENT}25`,
                      boxShadow: `0 0 24px ${ACCENT}12, inset 0 0 24px ${ACCENT}06`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-[1]"
                  style={active ? { filter: `drop-shadow(0 0 4px ${ACCENT})` } : undefined} />
                <span className="relative z-[1] hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ClassHierarchy />
                <CameraProfileComparison />
              </div>
              <BlueprintPanel color={ACCENT} className="p-4">
                <SectionHeader label="Architectural Components" />
                <FeatureGrid featureNames={CHARACTER_FEATURES} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
              </BlueprintPanel>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CharacterScalingPreview />
                <HitboxWireframeViewer />
              </div>
              <PropertyInspector />
            </div>
          )}

          {activeTab === 'input' && (
            <div className="space-y-5">
              <InputBindingsTable featureMap={featureMap} />
              <KeyboardVisualization />
            </div>
          )}

          {activeTab === 'movement' && (
            <div className="space-y-5">
              <MovementOverview />
              <DodgeTrajectorySection />
            </div>
          )}

          {activeTab === 'playground' && <CharacterFeelPlayground />}
          {activeTab === 'ai-feel' && <CharacterFeelOptimizer moduleId={moduleId} />}

          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <ComparisonMatrix
                selectedCharacters={selectedCharacters}
                visibleCharacters={visibleCharacters}
                onToggleCharacter={toggleCharacter}
              />
              <ArchetypeBalanceRadar balanceResults={balanceResults} scoreMean={scoreMean} />
              <PredictiveBalanceSimulator />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
