'use client';

import { useMemo, useState, useCallback } from 'react';
import { Skull, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_ORANGE, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner, SubTabNavigation } from '../_shared';
import type { SubTab } from '../_shared';
import { VisibleSection } from '../VisibleSection';
import type { EliteModifier, GroupBy, EnemyRole, ArchetypeConfig, BestiarySubtab } from './data';
import { ARCHETYPES, ELITE_MODIFIERS, BESTIARY_SUBTABS } from './data';
import { ArchetypesTab } from './archetypes/ArchetypesTab';
import { AILogicTab } from './ai-logic/AILogicTab';
import { EncountersTab } from './encounters/EncountersTab';
import { CodegenModal } from './archetypes/CodegenModal';
import FeatureMapTab from '../FeatureMapTab';
import { renderBestiaryMetric } from './metrics';

const ACCENT = ACCENT_ORANGE;

/* ── Narrative Breadcrumb ──────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as BestiarySubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...BESTIARY_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: BestiarySubtab; onNavigate: (tab: BestiarySubtab) => void }) {
  const activeIdx = NARRATIVE_STEPS.findIndex(s => s.key === activeTab);
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5">
      {NARRATIVE_STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-muted/40 mx-0.5">{'>'}</span>}
            <button
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? ACCENT : isPast ? withOpacity(ACCENT, '99') : 'var(--text-muted)',
                backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
                opacity: !isActive && !isPast ? 0.5 : 1,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </div>
  );
}

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
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | EnemyRole>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ArchetypeConfig['category']>('all');
  const [tierFilter, setTierFilter] = useState<'all' | ArchetypeConfig['tier']>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | string>('all');

  const filteredArchetypes = useMemo(() => {
    let result = ARCHETYPES;
    if (searchTerm) result = result.filter(a => a.label.toLowerCase().includes(searchTerm.toLowerCase()));
    if (roleFilter !== 'all') result = result.filter(a => a.role === roleFilter);
    if (categoryFilter !== 'all') result = result.filter(a => a.category === categoryFilter);
    if (tierFilter !== 'all') result = result.filter(a => a.tier === tierFilter);
    if (areaFilter !== 'all') result = result.filter(a => a.area === areaFilter);
    return result;
  }, [searchTerm, roleFilter, categoryFilter, tierFilter, areaFilter]);

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
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

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
                groupBy={groupBy} setGroupBy={setGroupBy}
                compareIds={compareIds} toggleCompare={toggleCompare}
                expandedArchetype={expandedArchetype} toggleArchetype={toggleArchetype}
                cardModifiers={cardModifiers} toggleCardModifier={toggleCardModifier}
                setCodegenMod={setCodegenMod}
                radarOverlays={radarOverlays} onToggleOverlay={toggleOverlay}
                accent={ACCENT}
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                roleFilter={roleFilter} setRoleFilter={setRoleFilter}
                categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                tierFilter={tierFilter} setTierFilter={setTierFilter}
                areaFilter={areaFilter} setAreaFilter={setAreaFilter}
                filteredArchetypes={filteredArchetypes}
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
