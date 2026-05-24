'use client';

import { VisibleSection } from '../../unique-tabs/VisibleSection';
import { InputBindingsTable } from './InputBindingsTable';
import { KeyboardVisualization } from './KeyboardVisualization';
import { AbilityQuickPicker } from './AbilityQuickPicker';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

interface Props {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
}

export function InputTab({ moduleId, featureMap }: Props) {
  return (
    <VisibleSection moduleId={moduleId} sectionId="bindings">
      <div className="space-y-5">
        <InputBindingsTable featureMap={featureMap} />
        <KeyboardVisualization />
        <AbilityQuickPicker />
      </div>
    </VisibleSection>
  );
}
