'use client';

import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { EntityFunctionalTestPanel } from '@/components/ecw/inspector/EntityFunctionalTestPanel';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

/**
 * Test track workspace (ECW Part 3b). Track state + Evaluate-CLI plus the
 * functional-test panel (the live UE-gate surface), absorbed from the inspector's
 * old standalone Functional Test section.
 */
export function TestWorkspace({ entity }: TrackWorkspaceProps) {
  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId="test" />
      <EntityFunctionalTestPanel entity={entity} />
    </div>
  );
}
