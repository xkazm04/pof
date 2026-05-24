'use client';

import type { ReactNode } from 'react';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import { ComboChainBuilder } from '../sub_combat/combos';
import { CoreSection } from './core/CoreSection';
import { AttributesSection } from './tags/AttributesSection';
import { TagsSection } from './tags/TagsSection';
import { AbilitiesSection } from './abilities/AbilitiesSection';
import { EffectsSection } from './effects/EffectsSection';
import { TagDepsSection } from './tags/TagDepsSection';
import { EffectsTimelineSection } from './effects/EffectsTimelineSection';
import { DamageCalcSection } from './abilities/DamageCalcSection';
import { TagAuditSection } from './tags/TagAuditSection';
import { LoadoutSection } from './abilities/LoadoutSection';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import type { SpellbookSubtab } from './_shared/types';

interface Props {
  activeTab: SpellbookSubtab;
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
  defs: FeatureDefinition[];
  expandedFeature: string | null;
  toggleFeature: (name: string) => void;
  renderMetric: (sectionId: string) => ReactNode;
}

export function SpellbookTabContent({ activeTab, moduleId, featureMap, defs, expandedFeature, toggleFeature, renderMetric }: Props) {
  return (
    <>
      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderMetric} />}
      {activeTab === 'core' && (
        <VisibleSection moduleId={moduleId} sectionId="architecture">
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div data-section-id="core"><CoreSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
            <div data-section-id="loadout"><LoadoutSection /></div>
          </div>
        </div>
        </VisibleSection>
      )}
      {activeTab === 'abilities' && (
        <VisibleSection moduleId={moduleId} sectionId="radar">
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div data-section-id="abilities"><AbilitiesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
            <div data-section-id="damage-calc"><DamageCalcSection /></div>
          </div>
        </div>
        </VisibleSection>
      )}
      {activeTab === 'effects' && (
        <VisibleSection moduleId={moduleId} sectionId="effects-timeline">
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div data-section-id="effects"><EffectsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
            <div data-section-id="effects-timeline"><EffectsTimelineSection /></div>
          </div>
        </div>
        </VisibleSection>
      )}
      {activeTab === 'tags' && (
        <VisibleSection moduleId={moduleId} sectionId="hierarchy">
        <div className="space-y-4">
          <div data-section-id="attributes"><AttributesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div data-section-id="tags"><TagsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
            <div className="space-y-4">
              <div data-section-id="tag-deps"><TagDepsSection /></div>
              <div data-section-id="tag-audit"><TagAuditSection /></div>
            </div>
          </div>
        </div>
        </VisibleSection>
      )}
      {activeTab === 'combos' && (
        <VisibleSection moduleId={moduleId} sectionId="timeline">
        <div data-section-id="combos">
          <ComboChainBuilder />
        </div>
        </VisibleSection>
      )}
    </>
  );
}
