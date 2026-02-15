import { NextRequest, NextResponse } from 'next/server';
import { getAudioScene } from '@/lib/audio-scene-db';
import { generateAudioCode } from '@/lib/audio-codegen';

function ok(data: unknown) {
  return NextResponse.json({ ok: true, data });
}
function err(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

// POST: generate code from an audio scene document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneId, moduleName, apiMacro } = body;

    if (!sceneId) return err('sceneId required');

    const doc = getAudioScene(sceneId);
    if (!doc) return err('Audio scene not found', 404);

    const result = generateAudioCode(
      doc,
      moduleName || 'MyProject',
      apiMacro || 'MYPROJECT_API',
    );

    return ok(result);
  } catch (e) {
    return err(String(e), 500);
  }
}
