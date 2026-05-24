'use client';

import { useState, useCallback, useMemo } from 'react';
import { Swords, Zap, GitBranch, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FeatureRow } from '@/types/feature-matrix';
import { PipelineFlow } from '../../unique-tabs/_shared';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ScalableSelector, type SelectorItem } from '@/components/shared/ScalableSelector';
import { LaneSection } from './LaneSection';
import { ComboChainDiagram } from './ComboChainDiagram';
import { SwimLaneDiagram } from './SwimLaneDiagram';
import { SequenceDiagram } from './SequenceDiagram';
import { ACCENT, LANES } from '../_shared/data';
import { WEAPONS } from '../_shared/data-metrics';
import type { Weapon } from '../_shared/data-metrics';

import { withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';

type WeaponItem = SelectorItem & Pick<Weapon, 'name' | 'category' | 'tier' | 'baseDamage' | 'attackSpeed'>;

interface FlowTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

export function FlowTab({ featureMap, defs, expanded, onToggle }: FlowTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([]);

  const weaponItems: WeaponItem[] = useMemo(
    () => WEAPONS.map(wp => ({
      id: wp.id, name: wp.name, category: wp.category,
      tier: wp.tier, baseDamage: wp.baseDamage, attackSpeed: wp.attackSpeed,
    })),
    [],
  );

  const handleSelect = useCallback((items: WeaponItem[]) => {
    setSelectedWeapons(items.map(i => i.id));
  }, []);

  const renderWeaponItem = useCallback((item: WeaponItem, selected: boolean) => (
    <div
      className="px-3 py-2 rounded-lg border text-xs font-mono cursor-pointer transition-all"
      style={{
        backgroundColor: selected ? withOpacity(ACCENT, '0a') : 'transparent',
        borderColor: selected ? withOpacity(ACCENT, '4d') : 'var(--border)',
      }}
    >
      <div className="font-bold text-text">{item.name}</div>
      <div className="text-text-muted">{item.category} &middot; {item.tier} &middot; {item.baseDamage} dmg</div>
    </div>
  ), []);

  const selectedNames = useMemo(() => {
    if (selectedWeapons.length === 0) return null;
    const set = new Set(selectedWeapons);
    return WEAPONS.filter(w => set.has(w.id)).map(w => w.category);
  }, [selectedWeapons]);

  /** Filter lanes: if weapons selected, only show lanes relevant to melee/ranged. */
  const filteredLanes = useMemo(() => {
    if (!selectedNames || selectedNames.length === 0) return LANES;
    const hasRanged = selectedNames.includes('Bow') || selectedNames.includes('Staff');
    const hasMelee = selectedNames.some(c => !['Bow', 'Staff'].includes(c));
    return LANES.filter(lane => {
      if (lane.id === 'feedback') return true;
      if (lane.id === 'offensive') return hasMelee;
      if (lane.id === 'pipeline') return hasMelee || hasRanged;
      return true;
    });
  }, [selectedNames]);

  return (
    <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="Execution Flow" color={ACCENT} icon={Zap} />
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer hover:bg-surface-hover"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
          >
            <Filter className="w-3 h-3" />
            {selectedWeapons.length > 0 ? `${selectedWeapons.length} weapons` : 'Filter weapons'}
          </button>
        </div>
        {selectedWeapons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {WEAPONS.filter(w => selectedWeapons.includes(w.id)).slice(0, 6).map(w => (
              <span key={w.id} className="px-2 py-0.5 rounded text-xs font-mono border"
                style={{ borderColor: withOpacity(w.color, OPACITY_20), color: w.color, backgroundColor: withOpacity(w.color, OPACITY_8) }}>
                {w.name}
              </span>
            ))}
            {selectedWeapons.length > 6 && <span className="text-2xs text-text-muted font-mono">+{selectedWeapons.length - 6} more</span>}
          </div>
        )}
        <div className="mt-1">
          <PipelineFlow steps={['Attack', 'Combo', 'Hit Detect', 'Damage', 'Reaction', 'Feedback']} accent={ACCENT} />
        </div>
      </BlueprintPanel>

      {/* Swim-Lane Flow Diagram */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Action Swim-Lane Diagram" color={ACCENT} icon={GitBranch} />
        <div className="mt-2 overflow-x-auto custom-scrollbar">
          <SwimLaneDiagram />
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionHeader label="Combat Lanes" color={ACCENT} icon={Swords} />
          <div className="space-y-4">
            {filteredLanes.map(lane => (
              <LaneSection key={lane.id} lane={lane} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <ComboChainDiagram status={featureMap.get('Combo system')?.status ?? 'unknown'} />
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Combat Event Sequence" color={ACCENT} icon={GitBranch} />
            <div className="mt-3 overflow-x-auto custom-scrollbar min-h-[200px]">
              <SequenceDiagram />
            </div>
          </BlueprintPanel>
        </div>
      </div>

      <ScalableSelector
        items={weaponItems}
        groupBy="category"
        renderItem={renderWeaponItem}
        onSelect={handleSelect}
        selected={selectedWeapons}
        searchKey="name"
        placeholder="Search weapons..."
        mode="multi"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Filter Weapons"
        accent={ACCENT}
      />
    </motion.div>
  );
}
