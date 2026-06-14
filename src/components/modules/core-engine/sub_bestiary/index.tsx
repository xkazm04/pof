'use client';

import { useState, useCallback } from 'react';
import { Skull, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner, SubTabNavigation } from '../unique-tabs/_shared';
import type { SubTab } from '../unique-tabs/_shared';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import type { EliteModifier, BestiarySubtab } from './_shared/data';
import { ELITE_MODIFIERS, BESTIARY_SUBTABS } from './_shared/data';
import { ArchetypesTab } from './archetypes/ArchetypesTab';
import { AILogicTab } from './ai-logic/AILogicTab';
import { EncountersTab } from './encounters/EncountersTab';
import { CodegenModal } from './archetypes/CodegenModal';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { renderBestiaryMetric } from './metrics';
import { NarrativeBreadcrumb } from './NarrativeBreadcrumb';
import { MicroLabel } from '@/components/ui/MicroLabel';

const ACCENT = ACCENT_ORANGE;

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: BestiarySubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = BESTIARY_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

/* ── Tab list derived from subtab defs ────────────────────────────────── */

const TABS: SubTab[] = [
  { id: 'features', label: 'Features', icon: LayoutGrid },
  ...BESTIARY_SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon } as SubTab)),
];

interface EnemyBestiaryProps {
  moduleId: SubModuleId;
}

export function EnemyBestiary({ moduleId }: EnemyBestiaryProps) {
  const { featureMap, stats, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<BestiarySubtab>('archetypes');

  /* Archetype selection & comparison (up to 4) */
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  /* Radar overlay toggles — only player enabled by default; compared enemies auto-added */
  const [radarOverlays, setRadarOverlays] = useState<Record<string, boolean>>({ player: true });

  /* Elite modifier system */
  const [cardModifiers, setCardModifiers] = useState<Record<string, string[]>>({});
  const [codegenMod, setCodegenMod] = useState<EliteModifier | null>(null);

  const toggleArchetype = useCallback((id: string) => {
    setExpandedArchetype(prev => prev === id ? null : id);
  }, []);

  const toggleCardModifier = useCallback((archetypeId: string, modId: string) => {
    setCardModifiers(prev => {
      const current = prev[archetypeId] ?? [];
      const mod = ELITE_MODIFIERS.find(m => m.id === modId);
      if (current.includes(modId)) {
        return { ...prev, [archetypeId]: current.filter(id => id !== modId) };
      }
      const excluded = mod?.excludes ?? [];
      const filtered = current.filter(id => !excluded.includes(id));
      return { ...prev, [archetypeId]: [...filtered, modId] };
    });
  }, []);

  const toggleOverlay = useCallback((key: string) => {
    setRadarOverlays(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-4">
      <TabHeader icon={Skull} title="Enemy Bestiary"
        implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ─────────────────────────────────────────── */}
      <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

      {/* ── Sub-Tab Navigation ──────────────────────────────────────────── */}
      <SubTabNavigation tabs={TABS} activeTabId={activeTab} onChange={(id) => setActiveTab(id as BestiarySubtab)} accent={ACCENT} />

      {/* ── Active Tab Subtitle ─────────────────────────────────────────── */}
      {subtitle && <MicroLabel as="p" mono className="-mt-1 mb-1 pl-0.5">{subtitle}</MicroLabel>}

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderBestiaryMetric} />}
          {activeTab === 'archetypes' && (
            <VisibleSection moduleId={moduleId} sectionId="cards">
              <ArchetypesTab
                featureMap={featureMap}
                compareIds={compareIds} toggleCompare={toggleCompare}
                expandedArchetype={expandedArchetype} toggleArchetype={toggleArchetype}
                cardModifiers={cardModifiers} toggleCardModifier={toggleCardModifier}
                setCodegenMod={setCodegenMod}
                radarOverlays={radarOverlays} onToggleOverlay={toggleOverlay}
                accent={ACCENT}
              />
            </VisibleSection>
          )}
          {activeTab === 'ai-logic' && (
            <VisibleSection moduleId={moduleId} sectionId="behavior-tree">
              <AILogicTab featureMap={featureMap} accent={ACCENT} />
            </VisibleSection>
          )}
          {activeTab === 'encounters' && (
            <VisibleSection moduleId={moduleId} sectionId="formations">
              <EncountersTab accent={ACCENT} />
            </VisibleSection>
          )}
        </motion.div>
      </AnimatePresence>

      <CodegenModal mod={codegenMod} onClose={() => setCodegenMod(null)} />
    </div>
  );
}
