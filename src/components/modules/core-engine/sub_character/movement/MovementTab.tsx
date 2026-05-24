'use client';

import { VisibleSection } from '../../unique-tabs/VisibleSection';
import { MovementOverview } from './MovementOverview';
import { DodgeTrajectorySection } from './DodgeTrajectorySection';
import type { SubModuleId } from '@/types/modules';

interface Props { moduleId: SubModuleId }

export function MovementTab({ moduleId }: Props) {
  return (
    <VisibleSection moduleId={moduleId} sectionId="states">
      <div className="space-y-5">
        <MovementOverview />
        <DodgeTrajectorySection />
      </div>
    </VisibleSection>
  );
}
