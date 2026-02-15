import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAllDocs, getDoc } from '@/lib/level-design-db';
import { getAudioScene, updateAudioScene, createAudioScene } from '@/lib/audio-scene-db';
import { generateSpatialAudio } from '@/lib/spatial-audio-generator';

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

      // Run the generator on a specific level-design doc → audio scene
      case 'generate': {
        const { levelDocId, audioSceneId } = body;
        if (!levelDocId) return apiError('levelDocId required', 400);

        const levelDoc = getDoc(Number(levelDocId));
        if (!levelDoc) return apiError('Level design document not found', 404);
        if (levelDoc.rooms.length === 0) return apiError('Level has no rooms', 400);

        const result = generateSpatialAudio({
          rooms: levelDoc.rooms,
          connections: levelDoc.connections,
          levelName: levelDoc.name,
        });

        // Apply to existing audio scene or create a new one
        if (audioSceneId) {
          const existing = getAudioScene(Number(audioSceneId));
          if (!existing) return apiError('Audio scene not found', 404);

          const merged = updateAudioScene({
            id: existing.id,
            zones: [...existing.zones, ...result.zones],
            emitters: [...existing.emitters, ...result.emitters],
            globalReverbPreset: result.globalReverbPreset,
            soundPoolSize: Math.max(existing.soundPoolSize, result.soundPoolSize),
            maxConcurrentSounds: Math.max(existing.maxConcurrentSounds, result.maxConcurrentSounds),
          });

          return apiSuccess({ audioScene: merged, report: result.report, merged: true });
        }

        // Create a new audio scene from the generation
        const newScene = createAudioScene({
          name: `${levelDoc.name} — Auto Audio`,
          description: `Auto-generated spatial audio from "${levelDoc.name}" level design (${result.zones.length} zones, ${result.emitters.length} emitters)`,
        });

        const populated = updateAudioScene({
          id: newScene.id,
          zones: result.zones,
          emitters: result.emitters,
          globalReverbPreset: result.globalReverbPreset,
          soundPoolSize: result.soundPoolSize,
          maxConcurrentSounds: result.maxConcurrentSounds,
        });

        return apiSuccess({ audioScene: populated, report: result.report, merged: false });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
