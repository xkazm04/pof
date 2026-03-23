'use client';

import { useMemo, useState, useCallback } from 'react';
import { Skull, Brain, Swords } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner, SubTabNavigation } from '../_shared';
import type { SubTab } from '../_shared';
import type { EliteModifier } from './data';
import { ARCHETYPES, ELITE_MODIFIERS } from './data';
import { ArchetypesTab } from './ArchetypesTab';
import { AILogicTab } from './AILogicTab';
import { EncountersTab } from './EncountersTab';
import { CodegenModal } from './CodegenModal';

const ACCENT = ACCENT_ORANGE;

interface EnemyBestiaryProps {
  moduleId: SubModuleId;
}

export function EnemyBestiary({ moduleId }: EnemyBestiaryProps) {
  const { featureMap, stats, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState('archetypes');

  /* Archetype selection & comparison */
  const [selectedEnemy, setSelectedEnemy] = useState<string | null>(null);
  const [compareEnemy, setCompareEnemy] = useState<string | null>(null);
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'class' | 'role'>('none');

  /* Radar overlay toggles */
  const [radarOverlays, setRadarOverlays] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { player: true };
    for (const a of ARCHETYPES) init[a.id] = true;
    return init;
  });

  /* Elite modifier system */
  const [cardModifiers, setCardModifiers] = useState<Record<string, string[]>>({});
  const [codegenMod, setCodegenMod] = useState<EliteModifier | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'archetypes', label: 'Archetypes & Stats', icon: Skull },
    { id: 'ai-logic', label: 'AI Logic & Senses', icon: Brain },
    { id: 'encounters', label: 'Encounters', icon: Swords },
  ], []);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Skull} title="Enemy Bestiary"
          implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'archetypes' && (
            <ArchetypesTab
              featureMap={featureMap}
              groupBy={groupBy} setGroupBy={setGroupBy}
              selectedEnemy={selectedEnemy} compareEnemy={compareEnemy}
              setSelectedEnemy={setSelectedEnemy} setCompareEnemy={setCompareEnemy}
              expandedArchetype={expandedArchetype} toggleArchetype={toggleArchetype}
              cardModifiers={cardModifiers} toggleCardModifier={toggleCardModifier}
              setCodegenMod={setCodegenMod}
              radarOverlays={radarOverlays} onToggleOverlay={toggleOverlay}
              accent={ACCENT}
            />
          )}
          {activeTab === 'ai-logic' && (
            <AILogicTab featureMap={featureMap} accent={ACCENT} />
          )}
          {activeTab === 'encounters' && (
            <EncountersTab accent={ACCENT} />
          )}
        </AnimatePresence>
      </div>

      <CodegenModal mod={codegenMod} onClose={() => setCodegenMod(null)} />
    </div>
  );
}
