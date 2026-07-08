'use client';

import { TabHeader } from '@/components/modules/shared/TabHeader';
import { BlenderSetup } from '@/components/modules/visual-gen/blender-pipeline/BlenderSetup';
import { ScriptRunner } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';

/* ─── Pipeline Tab ──────────────────────────────────────────────────────── */

export function PipelineTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="Blender Automation Pipeline"
        description="Execute Blender scripts remotely via MCP for batch conversion, LOD generation, and mesh optimization"
      />
      <BlenderSetup />
      <ScriptRunner />
    </div>
  );
}
