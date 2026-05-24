import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { AUDIO_DIR } from '@/lib/audio-asset-db';
import { apiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const relPath = new URL(request.url).searchParams.get('relPath');
  if (!relPath) return apiError('Missing relPath', 400);

  // Prevent path traversal: resolve against AUDIO_DIR and assert containment.
  const abs = normalize(join(AUDIO_DIR, relPath));
  if (!abs.startsWith(normalize(AUDIO_DIR))) return apiError('Invalid path', 400);
  if (!existsSync(abs)) return apiError('Not found', 404);

  const bytes = readFileSync(abs);
  const ext = abs.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': ext, 'Cache-Control': 'no-cache' } });
}
