'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ArchetypeConfig, GroupBy, EliteModifier } from './data';
import { ARCHETYPES, RADAR_DATA } from './data';
import { ArchetypeCard } from './ArchetypeCard';
import { ComparisonPanel } from './ComparisonPanel';
import { RadarComparison } from './RadarComparison';
import { KillDeathStats } from './KillDeathStats';

interface ArchetypesTabProps {
  featureMap: Map<string, FeatureRow>;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  selectedEnemy: string | null;
  compareEnemy: string | null;
  setSelectedEnemy: (id: string | null) => void;
  setCompareEnemy: (id: string | null) => void;
  expandedArchetype: string | null;
  toggleArchetype: (id: string) => void;
  cardModifiers: Record<string, string[]>;
  toggleCardModifier: (archetypeId: string, modId: string) => void;
  setCodegenMod: (mod: EliteModifier) => void;
  radarOverlays: Record<string, boolean>;
  onToggleOverlay: (key: string) => void;
  accent: string;
}

export function ArchetypesTab({
  featureMap, groupBy, setGroupBy,
  selectedEnemy, compareEnemy, setSelectedEnemy, setCompareEnemy,
  expandedArchetype, toggleArchetype,
  cardModifiers, toggleCardModifier, setCodegenMod,
  radarOverlays, onToggleOverlay, accent,
}: ArchetypesTabProps) {
  const selectedArchetype = useMemo(() => ARCHETYPES.find(a => a.id === selectedEnemy), [selectedEnemy]);
  const compareArchetype = useMemo(() => ARCHETYPES.find(a => a.id === compareEnemy), [compareEnemy]);

  const activeOverlays = useMemo(() =>
    ARCHETYPES
      .filter(a => radarOverlays[a.id] && RADAR_DATA[a.id])
      .map(a => ({ data: RADAR_DATA[a.id], color: a.color, label: a.label })),
  [radarOverlays]);

  const groupedArchetypes = useMemo(() => {
    if (groupBy === 'none') return [{ header: null, items: ARCHETYPES }];
    const groups = new Map<string, ArchetypeConfig[]>();
    for (const a of ARCHETYPES) {
      const key = groupBy === 'class' ? a.class : a.role;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries()).map(([header, items]) => ({ header, items }));
  }, [groupBy]);

  return (
    <motion.div
      key="archetypes"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Group filter bar */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Group by:</span>
        {(['none', 'class', 'role'] as const).map((g) => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              groupBy === g ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
            }`}>
            {g === 'none' ? 'None' : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* Enemy Selector Grid */}
      <EnemySelectorGrid
        selectedEnemy={selectedEnemy}
        compareEnemy={compareEnemy}
        setSelectedEnemy={setSelectedEnemy}
        setCompareEnemy={setCompareEnemy}
      />

      {selectedEnemy && (
        <div className="text-sm text-text-muted mb-2">
          {compareEnemy
            ? <>Comparing <span className="font-bold" style={{ color: selectedArchetype?.color }}>{selectedArchetype?.label}</span> vs <span className="font-bold" style={{ color: compareArchetype?.color }}>{compareArchetype?.label}</span>. Click a selected enemy to deselect.</>
            : <>Selected <span className="font-bold" style={{ color: selectedArchetype?.color }}>{selectedArchetype?.label}</span>. Click another enemy to compare.</>}
        </div>
      )}

      {/* Side-by-side comparison */}
      {selectedArchetype && compareArchetype && (
        <ComparisonPanel selected={selectedArchetype} compare={compareArchetype} accent={accent} />
      )}

      {/* Archetype cards */}
      {groupedArchetypes.map((group) => (
        <div key={group.header ?? 'all'}>
          {group.header && (
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 mt-2">{group.header}</div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {group.items.map((archetype, i) => (
              <motion.div key={archetype.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <ArchetypeCard
                  archetype={archetype}
                  featureMap={featureMap}
                  expanded={expandedArchetype === archetype.id}
                  onToggle={toggleArchetype}
                  activeModifiers={cardModifiers[archetype.id] ?? []}
                  onToggleModifier={(modId) => toggleCardModifier(archetype.id, modId)}
                  onViewCodegen={setCodegenMod}
                />
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RadarComparison
          radarOverlays={radarOverlays}
          onToggleOverlay={onToggleOverlay}
          activeOverlays={activeOverlays}
          accent={accent}
        />
        <KillDeathStats accent={accent} />
      </div>
    </motion.div>
  );
}

/* ── Enemy Selector Grid ──────────────────────────────────────────────── */

function EnemySelectorGrid({
  selectedEnemy, compareEnemy, setSelectedEnemy, setCompareEnemy,
}: {
  selectedEnemy: string | null;
  compareEnemy: string | null;
  setSelectedEnemy: (id: string | null) => void;
  setCompareEnemy: (id: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
      {ARCHETYPES.map(enemy => {
        const isSelected = selectedEnemy === enemy.id;
        const isCompare = compareEnemy === enemy.id;
        return (
          <button key={enemy.id}
            onClick={() => {
              if (isSelected) { setSelectedEnemy(null); setCompareEnemy(null); }
              else if (selectedEnemy && !isCompare) setCompareEnemy(enemy.id);
              else { setSelectedEnemy(enemy.id); setCompareEnemy(null); }
            }}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              isSelected ? 'ring-2' : isCompare ? 'ring-1 ring-dashed' : 'hover:border-border-bright'
            }`}
            style={isSelected ? {
              borderColor: `${enemy.color}60`, backgroundColor: `${enemy.color}12`,
              boxShadow: `0 0 12px ${enemy.color}20`,
            } : isCompare ? {
              borderColor: `${enemy.color}40`, backgroundColor: `${enemy.color}08`,
            } : { borderColor: 'var(--border)' }}>
            <div className="text-sm font-bold" style={{ color: isSelected || isCompare ? enemy.color : 'var(--text)' }}>
              {enemy.label}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{enemy.role}</div>
          </button>
        );
      })}
    </div>
  );
}
