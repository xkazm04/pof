import { NextRequest } from 'next/server';
import { planWrite, applyWrite, type WriteInput } from '@/lib/blueprint-transpiler-write';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectPath, moduleName, className, header, source, confirm, approved } = body;
    if (!projectPath || !moduleName || !className) {
      return apiError('projectPath, moduleName and className are required', 400);
    }
    const input: WriteInput = { projectPath, moduleName, className, header: header ?? '', source: source ?? '' };
    if (confirm === true) {
      // `approved` carries the dry-run plan the user actually reviewed —
      // applyWrite rejects when the resolved paths or on-disk content drifted.
      return apiSuccess(await applyWrite(input, Array.isArray(approved) ? approved : undefined));
    }
    return apiSuccess(await planWrite(input)); // dry-run
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to write transpiled C++');
  }
}
