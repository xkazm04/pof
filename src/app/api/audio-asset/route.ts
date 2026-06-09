import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, relative, isAbsolute } from 'node:path';
import { AUDIO_DIR } from '@/lib/audio-asset-db';
import { apiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const relPath = new URL(request.url).searchParams.get('relPath');
  if (!relPath) return apiError('Missing relPath', 400);

  // Prevent path traversal. The previous `abs.startsWith(normalize(AUDIO_DIR))` was a prefix
  // match with no trailing separator, so a sibling dir whose name merely *starts with* the
  // basename (e.g. `audio-secrets`) passed, and `..` segments could climb out entirely.
  // Make containment structural: reject `..` up front, then require the resolved path to be
  // strictly inside AUDIO_DIR via `path.relative` (non-empty, not `..`-prefixed, not absolute).
  if (relPath.includes('..')) return apiError('Invalid path', 400);
  const root = normalize(AUDIO_DIR);
  const abs = normalize(join(root, relPath));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return apiError('Invalid path', 400);
  if (!existsSync(abs)) return apiError('Not found', 404);

  const bytes = readFileSync(abs);
  const ext = abs.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': ext, 'Cache-Control': 'no-cache' } });
}
