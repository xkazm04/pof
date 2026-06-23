import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildLedger } from '@/lib/animation/reality-ledger.mjs';

// GET /api/animation-ledger?projectPath=<UE project root>
//   Reconciles what generated UE5 code references vs what assets exist vs whether
//   they're valid vs runtime failures → a red/green animation reality ledger.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectPath = searchParams.get('projectPath');
    if (!projectPath) return apiError('projectPath required', 400);
    if (!fs.existsSync(path.join(projectPath, 'Content')) && !fs.existsSync(path.join(projectPath, 'Source'))) {
      return apiError('projectPath has no Content/ or Source/ — not a UE project root', 400);
    }
    const ledger = buildLedger({ projectPath });
    return apiSuccess(ledger);
  } catch (err) {
    console.error('GET /api/animation-ledger error:', err);
    return apiError('Internal error', 500);
  }
}
