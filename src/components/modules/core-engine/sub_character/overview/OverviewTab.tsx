'use client';

import { useCallback, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { withOpacity, OPACITY_8, OPACITY_22 } from '@/lib/chart-colors';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import { FeatureGrid } from '../../unique-tabs/_shared';
import { VisibleSection } from '../../unique-tabs/VisibleSection';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import {
  ACCENT, CHARACTER_FEATURES, COMPARISON_CHARACTERS, type SelectableCharacter,
} from '../_shared/data';
import { ClassHierarchy } from './ClassHierarchy';
import { CameraProfileComparison } from './CameraProfileComparison';
import { CharacterScalingPreview } from './CharacterScalingPreview';
import { HitboxWireframeViewer } from './HitboxWireframeViewer';
import { PropertyInspector } from './PropertyInspector';
import type { FeatureRow } from '@/types/feature-matrix';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

interface Props {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
  defs: FeatureDefinition[];
}

export function OverviewTab({ moduleId, featureMap, defs }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  const [overviewCharId, setOverviewCharId] = useState<string | null>(null);
  const [overviewPickerOpen, setOverviewPickerOpen] = useState(false);
  const overviewChar = useMemo(
    () => (overviewCharId ? COMPARISON_CHARACTERS.find((c) => c.id === overviewCharId) ?? null : null),
    [overviewCharId],
  );

  return (
    <div className="space-y-5">
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOverviewPickerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono font-bold border border-dashed border-border/50 text-text-muted hover:text-text hover:border-border transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            {overviewChar ? overviewChar.name : 'Select Character'}
          </button>
          {overviewChar && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: overviewChar.color }} />
              <span
                className="px-1.5 py-0.5 rounded border text-xs font-bold"
                style={{
                  color: overviewChar.color,
                  borderColor: withOpacity(overviewChar.color, OPACITY_22),
                  backgroundColor: withOpacity(overviewChar.color, OPACITY_8),
                }}
              >
                {overviewChar.category}
              </span>
              <span className="text-text-muted capitalize">{overviewChar.tier}</span>
              <span className="text-text-muted">{overviewChar.area}</span>
            </div>
          )}
        </div>
      </BlueprintPanel>
      <ScalableSelector<SelectableCharacter>
        items={COMPARISON_CHARACTERS}
        groupBy="area"
        renderItem={(item: SelectableCharacter, sel: boolean) => (
          <div
            className={`flex items-center gap-2 px-2 py-1.5 text-xs font-mono transition-all ${sel ? 'font-bold' : 'opacity-60'}`}
            style={sel ? { color: item.color } : { color: 'var(--text-muted)' }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
            <span className="text-[9px] text-text-muted ml-auto">{item.category}</span>
          </div>
        )}
        onSelect={(items: SelectableCharacter[]) => setOverviewCharId(items[0]?.id ?? null)}
        selected={overviewCharId ? [overviewCharId] : []}
        searchKey="name"
        mode="single"
        open={overviewPickerOpen}
        onClose={() => setOverviewPickerOpen(false)}
        title="Select Character"
        accent={ACCENT}
      />

      <VisibleSection moduleId={moduleId} sectionId="class-hierarchy">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ClassHierarchy />
          <CameraProfileComparison />
        </div>
      </VisibleSection>
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader label="Architectural Components" />
        <FeatureGrid
          featureNames={CHARACTER_FEATURES}
          featureMap={featureMap}
          defs={defs}
          expanded={expanded}
          onToggle={toggleExpand}
          accent={ACCENT}
        />
      </BlueprintPanel>
      <VisibleSection moduleId={moduleId} sectionId="scaling">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CharacterScalingPreview />
          <HitboxWireframeViewer />
        </div>
      </VisibleSection>
      <VisibleSection moduleId={moduleId} sectionId="properties">
        <PropertyInspector />
      </VisibleSection>
    </div>
  );
}
