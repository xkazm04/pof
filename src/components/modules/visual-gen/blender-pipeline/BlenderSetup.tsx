'use client';

import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';

export function BlenderSetup() {
  return (
    <div className="space-y-3">
      <BlenderConnectionBar />
      <ViewportPreview />
    </div>
  );
}
