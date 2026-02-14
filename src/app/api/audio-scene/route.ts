import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getAllAudioScenes,
  getAudioScene,
  createAudioScene,
  updateAudioScene,
  deleteAudioScene,
  getAudioSceneSummary,
} from '@/lib/audio-scene-db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');

  if (id) {
    const doc = getAudioScene(Number(id));
    if (!doc) return apiError('Not found', 404);
    return apiSuccess({ doc });
  }

  const docs = getAllAudioScenes();
  const summary = getAudioSceneSummary();
  return apiSuccess({ docs, summary });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description } = body;
  if (!name || typeof name !== 'string') {
    return apiError('name is required', 400);
  }
  const doc = createAudioScene({ name, description });
  return apiSuccess({ doc }, 201);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id || typeof body.id !== 'number') {
    return apiError('id is required', 400);
  }
  const doc = updateAudioScene(body);
  if (!doc) return apiError('Not found', 404);
  return apiSuccess({ doc });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  if (!id) return apiError('id is required', 400);
  const ok = deleteAudioScene(Number(id));
  if (!ok) return apiError('Not found', 404);
  return apiSuccess({ deleted: true });
}
