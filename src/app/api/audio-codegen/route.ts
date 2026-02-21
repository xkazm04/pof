import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAudioScene } from '@/lib/audio-scene-db';
import { generateAudioCode } from '@/lib/audio-codegen';

// POST: generate code from an audio scene document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneId, moduleName, apiMacro } = body;

    if (!sceneId) return apiError('sceneId required', 400);

    const doc = getAudioScene(sceneId);
    if (!doc) return apiError('Audio scene not found', 404);

    const result = generateAudioCode(
      doc,
      moduleName || 'MyProject',
      apiMacro || 'MYPROJECT_API',
    );

    return apiSuccess(result);
  } catch (e) {
    return apiError(String(e));
  }
}
