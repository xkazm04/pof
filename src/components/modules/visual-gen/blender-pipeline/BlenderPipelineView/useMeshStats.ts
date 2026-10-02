'use client';

import { useState, useCallback } from 'react';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import { meshStatsScript, readMeshStats, type MeshStat } from '@/lib/blender-mcp/scripts/mesh-stats';

export type MeshStatsState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'read'; meshes: MeshStat[] }
  | { status: 'failed'; reason: string };

/**
 * The scene's meshes in triangles, read by ONE explicit dispatch (never on
 * mount): `meshStatsScript` through `executeViaMCP`, so the read is recorded in
 * Script History like any other script. Only a confirmed `mesh-stats` receipt
 * yields meshes; anything else is `failed` with its reason.
 */
export function useMeshStats() {
  const [state, setState] = useState<MeshStatsState>({ status: 'idle' });

  const read = useCallback(async () => {
    setState({ status: 'reading' });
    const res = await executeViaMCP('Mesh Stats', meshStatsScript());
    if (!res.ok) {
      setState({ status: 'failed', reason: res.error });
      return;
    }
    const stats = readMeshStats(res.data);
    setState(stats.state === 'confirmed' ? { status: 'read', meshes: stats.meshes } : { status: 'failed', reason: stats.reason });
  }, []);

  return { state, read };
}
