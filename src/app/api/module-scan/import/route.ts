import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

const findingSchema = z.object({
  pass: z.enum(['structure', 'quality', 'performance']),
  category: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string().nullable().default(null),
  line: z.number().nullable().default(null),
  description: z.string().min(1),
  suggestedFix: z.string().default(''),
  effort: z.enum(['trivial', 'small', 'medium', 'large']).default('medium'),
});

const importSchema = z.object({
  moduleId: z.string().min(1),
  findings: z.array(findingSchema),
});

/**
 * POST — Claude submits scan findings via curl during a scan session.
 * Validates, assigns IDs, and persists to the eval_findings table.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(`Invalid scan data: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
    }

    const { moduleId, findings } = parsed.data;
    if (findings.length === 0) {
      return apiSuccess({ moduleId, imported: 0, findings: [] });
    }

    // Generate a scan_id for this batch
    const scanId = `scan-${moduleId}-${Date.now()}`;
    const now = new Date().toISOString();

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO eval_findings
        (id, scan_id, module_id, pass, category, severity, file, line, description, suggested_fix, effort, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const enriched = findings.map((f, i) => {
      const id = `${scanId}-${i}`;
      insert.run(id, scanId, moduleId, f.pass, f.category, f.severity, f.file, f.line, f.description, f.suggestedFix, f.effort, now);
      return { ...f, id, foundAt: now };
    });

    return apiSuccess({
      moduleId,
      imported: enriched.length,
      findings: enriched,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to import scan findings', 500);
  }
}

interface EvalFindingRow {
  id: string;
  scan_id: string;
  module_id: string;
  pass: string;
  category: string;
  severity: string;
  file: string | null;
  line: number | null;
  description: string;
  suggested_fix: string;
  effort: string;
  created_at: string;
}

/**
 * GET — Retrieve persisted scan findings for a module.
 * Query params: moduleId (required), limit (optional, default 200)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get('moduleId');
    if (!moduleId) {
      return apiError('moduleId query parameter is required', 400);
    }

    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000);

    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM eval_findings WHERE module_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(moduleId, limit) as EvalFindingRow[];

    const findings = rows.map((r) => ({
      id: r.id,
      pass: r.pass as 'structure' | 'quality' | 'performance',
      category: r.category,
      severity: r.severity as 'critical' | 'high' | 'medium' | 'low',
      file: r.file,
      line: r.line,
      description: r.description,
      suggestedFix: r.suggested_fix,
      effort: r.effort as 'trivial' | 'small' | 'medium' | 'large',
      foundAt: r.created_at,
    }));

    return apiSuccess({ moduleId, findings });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to fetch scan findings', 500);
  }
}
