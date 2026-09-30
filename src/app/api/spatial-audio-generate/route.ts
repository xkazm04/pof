import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAllDocs, getDoc } from '@/lib/level-design-db';
import { getAudioScene, updateAudioScene, createAudioScene } from '@/lib/audio-scene-db';
import { generateSpatialAudio } from '@/lib/spatial-audio-generator';
import { planLevelAudioSync } from '@/lib/spatial-audio-sync';
import { applySceneOps, type SceneDraft } from '@/lib/audio-scene-ops';

const EMPTY_SCENE: SceneDraft = { zones: [], emitters: [] };

/**
 * Level -> audio sync. `preview` returns the plan (one row per room, the
 * SceneOps it would apply) and writes nothing; `generate` applies that plan
 * through the scene's one reducer, so a re-run is idempotent and a hand-tuned
 * room is kept unless its id is listed in `overwrite`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // List available level-design docs for the picker
      case 'list-levels': {
        const docs = getAllDocs();
        const items = docs.map((d) => ({
          id: d.id,
          name: d.name,
          roomCount: d.rooms.length,
          connectionCount: d.connections.length,
        }));
        return apiSuccess(items);
      }

      case 'preview':
      case 'generate': {
        const { levelDocId, audioSceneId } = body;
        const overwrite: string[] = Array.isArray(body.overwrite)
          ? body.overwrite.filter((id: unknown): id is string => typeof id === 'string')
          : [];
        if (!levelDocId) return apiError('levelDocId required', 400);

        const levelDoc = getDoc(Number(levelDocId));
        if (!levelDoc) return apiError('Level design document not found', 404);
        if (levelDoc.rooms.length === 0) return apiError('Level has no rooms', 400);

        const existing = audioSceneId ? getAudioScene(Number(audioSceneId)) : null;
        if (audioSceneId && !existing) return apiError('Audio scene not found', 404);

        const result = generateSpatialAudio({
          rooms: levelDoc.rooms,
          connections: levelDoc.connections,
          levelName: levelDoc.name,
        });
        const plan = planLevelAudioSync(existing ?? EMPTY_SCENE, result, { overwrite });

        if (action === 'preview') {
          return apiSuccess({ ...plan, report: result.report, targetSceneId: existing?.id ?? null });
        }

        if (existing) {
          const next = applySceneOps(existing, plan.ops);
          // The scene's own settings stay its own: global reverb is only a
          // suggestion for a NEW scene, and the pool sizes only ever grow.
          const merged = updateAudioScene({
            id: existing.id,
            zones: next.zones,
            emitters: next.emitters,
            soundPoolSize: Math.max(existing.soundPoolSize, result.soundPoolSize),
            maxConcurrentSounds: Math.max(existing.maxConcurrentSounds, result.maxConcurrentSounds),
          });
          return apiSuccess({ audioScene: merged, report: result.report, rows: plan.rows, summary: plan.summary, merged: true });
        }

        const created = applySceneOps(EMPTY_SCENE, plan.ops);
        const newScene = createAudioScene({
          name: `${levelDoc.name} — Auto Audio`,
          description: `Auto-generated spatial audio from "${levelDoc.name}" level design (${created.zones.length} zones, ${created.emitters.length} emitters)`,
        });
        const populated = updateAudioScene({
          id: newScene.id,
          zones: created.zones,
          emitters: created.emitters,
          globalReverbPreset: plan.suggestedGlobalReverb,
          soundPoolSize: result.soundPoolSize,
          maxConcurrentSounds: result.maxConcurrentSounds,
        });
        return apiSuccess({ audioScene: populated, report: result.report, rows: plan.rows, summary: plan.summary, merged: false });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
