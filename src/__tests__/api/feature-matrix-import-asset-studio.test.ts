/**
 * Round-trip proof for the nine Asset Studio modules.
 *
 * Feature rows are ingested from CLI review reports that
 * `/api/feature-matrix/import` validates against `MODULE_FEATURE_DEFINITIONS`.
 * While those nine modules declared NO definitions the validator skipped name
 * checking for them entirely (`knownNames === null`) — so the gap was upstream
 * of the checklist mapping: an undeclared module could not be mapped, and any
 * name at all sailed through unchecked.
 *
 * Now that the definitions exist, this pins BOTH halves of the new contract on
 * the real route + real validator + real SQLite (throwaway DB):
 *   • a report using the declared names is ACCEPTED and readable back;
 *   • a hallucinated name for the same module is now REJECTED with a reason.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-import-asset-studio-${process.pid}.db`;
});

import { POST } from '@/app/api/feature-matrix/import/route';
import { getFeaturesByModule, clearModuleFeatures } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const ASSET_STUDIO: SubModuleId[] = [
  'asset-viewer', 'asset-forge', 'material-lab', 'blender-pipeline', 'asset-browser',
  'import-automation', 'auto-rig', 'procedural-engine', 'scene-composer',
];

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/feature-matrix/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function importReport(moduleId: SubModuleId, features: unknown[]) {
  const res = await POST(post({ moduleId, reviewedAt: '2026-08-18T00:00:00.000Z', features }));
  return { status: res.status, body: await res.json() };
}

describe('feature-matrix import round-trips for the Asset Studio modules', () => {
  it('accepts a report that uses asset-viewer’s declared feature names', async () => {
    clearModuleFeatures('asset-viewer');
    const declared = MODULE_FEATURE_DEFINITIONS['asset-viewer']!;
    expect(declared.length).toBeGreaterThan(0);

    const { status, body } = await importReport(
      'asset-viewer',
      declared.map((d) => ({
        featureName: d.featureName,
        category: d.category,
        status: 'implemented',
        description: d.description,
        filePaths: ['src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx'],
      })),
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.imported).toBe(declared.length);
    expect(body.data.rejected).toBeUndefined();

    // …and the rows are actually readable back under those exact names.
    const stored = getFeaturesByModule('asset-viewer');
    expect(stored.map((r) => r.featureName).sort()).toEqual(
      declared.map((d) => d.featureName).sort(),
    );
  });

  it('now REJECTS a hallucinated name for the same module', async () => {
    clearModuleFeatures('asset-viewer');
    const { status, body } = await importReport('asset-viewer', [
      { featureName: 'Orbit controls', category: 'Camera', status: 'implemented' },
      { featureName: 'Holographic Ray Tracer', category: 'Camera', status: 'implemented' },
    ]);

    expect(status).toBe(200);
    expect(body.data.imported).toBe(1);
    expect(body.data.rejected).toHaveLength(1);
    expect(body.data.rejected[0].featureName).toBe('Holographic Ray Tracer');
    expect(body.data.rejected[0].reasons[0]).toContain('not found in MODULE_FEATURE_DEFINITIONS');

    expect(getFeaturesByModule('asset-viewer').map((r) => r.featureName)).toEqual(['Orbit controls']);
  });

  it('accepts the first declared feature of every one of the nine modules', async () => {
    for (const moduleId of ASSET_STUDIO) {
      clearModuleFeatures(moduleId);
      const first = MODULE_FEATURE_DEFINITIONS[moduleId]![0];
      const { status, body } = await importReport(moduleId, [
        { featureName: first.featureName, category: first.category, status: 'partial' },
      ]);
      expect(status, moduleId).toBe(200);
      expect(body.data.imported, moduleId).toBe(1);
      expect(getFeaturesByModule(moduleId)[0].featureName, moduleId).toBe(first.featureName);
    }
  });
});
