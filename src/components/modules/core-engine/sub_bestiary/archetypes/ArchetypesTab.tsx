'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ArchetypeConfig, GroupBy, EliteModifier, EnemyRole } from '../_shared/data';
import { ARCHETYPES, RADAR_DATA } from '../_shared/data';
import { ComparisonPanel } from './ComparisonPanel';
import { RadarComparison } from './RadarComparison';
import { KillDeathStats } from '../encounters/KillDeathStats';
import { BestiaryFilters } from './BestiaryFilters';
import { CompareHint } from './CompareHint';
import { ArchetypeGrid } from './ArchetypeGrid';
import { PrimaryArchetypeLifecycle } from './PrimaryArchetypeLifecycle';

const PAGE_SIZE = 24;

interface ArchetypesTabProps {
  featureMap: Map<string, FeatureRow>;
  compareIds: string[];
  toggleCompare: (id: string) => void;
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
  featureMap,
  compareIds, toggleCompare,
  expandedArchetype, toggleArchetype,
  cardModifiers, toggleCardModifier, setCodegenMod,
  radarOverlays, onToggleOverlay, accent,
}: ArchetypesTabProps) {
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

  const [page, setPage] = useState(0);
  const [prevFilterLen, setPrevFilterLen] = useState(filteredArchetypes.length);
  if (prevFilterLen !== filteredArchetypes.length) {
    setPrevFilterLen(filteredArchetypes.length);
    if (page !== 0) setPage(0);
  }

  const compareArchetypes = useMemo(
    () => compareIds.map(id => ARCHETYPES.find(a => a.id === id)).filter(Boolean) as ArchetypeConfig[],
    [compareIds],
  );

  const activeOverlays = useMemo(() =>
    ARCHETYPES
      .filter(a => radarOverlays[a.id] && RADAR_DATA[a.id])
      .map(a => ({ data: RADAR_DATA[a.id], color: a.color, label: a.label })),
  [radarOverlays]);

  const groupedArchetypes = useMemo(() => {
    if (groupBy === 'none') return [{ header: null, items: filteredArchetypes }];
    const groups = new Map<string, ArchetypeConfig[]>();
    for (const a of filteredArchetypes) {
      const key = groupBy === 'class' ? a.class
        : groupBy === 'role' ? a.role
        : groupBy === 'category' ? a.category
        : groupBy === 'tier' ? a.tier
        : groupBy === 'area' ? a.area
        : a.class;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([header, items]) => ({ header, items }));
  }, [groupBy, filteredArchetypes]);

  /* Pagination over flat list (when not grouped) */
  const totalPages = groupBy === 'none'
    ? Math.ceil(filteredArchetypes.length / PAGE_SIZE) : 0;

  const paginatedGroups = useMemo(() => {
    if (groupBy !== 'none') return groupedArchetypes;
    const start = page * PAGE_SIZE;
    return [{ header: null, items: filteredArchetypes.slice(start, start + PAGE_SIZE) }];
  }, [groupBy, groupedArchetypes, filteredArchetypes, page]);

  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setCategoryFilter('all');
    setTierFilter('all');
    setAreaFilter('all');
  };

  return (
    <motion.div
      key="archetypes"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Search + filters + group bar */}
      <BestiaryFilters
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
        tierFilter={tierFilter} setTierFilter={setTierFilter}
        areaFilter={areaFilter} setAreaFilter={setAreaFilter}
        groupBy={groupBy} setGroupBy={setGroupBy}
        filteredCount={filteredArchetypes.length}
      />

      {/* folder-09 R3: catalog lifecycle cell for the primary archetype */}
      <PrimaryArchetypeLifecycle
        expandedArchetype={expandedArchetype}
        filteredArchetypes={filteredArchetypes}
      />

      {/* Compare selection hint */}
      <CompareHint
        compareIds={compareIds}
        compareArchetypes={compareArchetypes}
        toggleCompare={toggleCompare}
      />

      {/* Multi-enemy comparison */}
      {compareArchetypes.length >= 2 && (
        <ComparisonPanel enemies={compareArchetypes} accent={accent} />
      )}

      {/* Archetype cards + pagination + empty state */}
      <ArchetypeGrid
        filteredArchetypes={filteredArchetypes}
        paginatedGroups={paginatedGroups}
        groupedArchetypes={groupedArchetypes}
        groupBy={groupBy}
        totalPages={totalPages}
        page={page}
        setPage={setPage}
        featureMap={featureMap}
        expandedArchetype={expandedArchetype}
        toggleArchetype={toggleArchetype}
        cardModifiers={cardModifiers}
        toggleCardModifier={toggleCardModifier}
        setCodegenMod={setCodegenMod}
        compareIds={compareIds}
        toggleCompare={toggleCompare}
        resetFilters={resetFilters}
      />

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
