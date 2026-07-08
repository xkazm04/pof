import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listModelPolicy, setModelPolicy, TASK_CLASSES, type TaskClass, type ClaudeModel, type Effort } from '@/lib/model-policy';

/** GET /api/model-policy — every task class → resolved {model, effort} + provenance. */
export function GET() {
  try {
    return apiSuccess(listModelPolicy());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'model-policy GET failed', 500);
  }
}

const MODELS: ClaudeModel[] = ['haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** PUT /api/model-policy — pin/override one task class. Body:
 *  { taskClass, model, effort, source?: 'manual'|'benchmark', benchmarkScore? }. */
export async function PUT(req: NextRequest) {
  try {
    const b = (await req.json()) as {
      taskClass?: string; model?: string; effort?: string;
      source?: 'manual' | 'benchmark'; benchmarkScore?: number;
    };
    if (!TASK_CLASSES.includes(b.taskClass as TaskClass)) return apiError(`Unknown taskClass: ${b.taskClass}`, 400);
    if (!MODELS.includes(b.model as ClaudeModel)) return apiError(`Unknown model: ${b.model}`, 400);
    if (!EFFORTS.includes(b.effort as Effort)) return apiError(`Unknown effort: ${b.effort}`, 400);
    setModelPolicy(
      b.taskClass as TaskClass,
      { model: b.model as ClaudeModel, effort: b.effort as Effort },
      b.source === 'benchmark' ? 'benchmark' : 'manual',
      b.benchmarkScore,
    );
    return apiSuccess(listModelPolicy());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'model-policy PUT failed', 500);
  }
}
