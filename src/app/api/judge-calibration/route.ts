import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import {
  CALIBRATION,
  calibrationKey,
  evaluateCalibration,
  latestCalibrationRun,
  type CalibrationRun,
} from '@/lib/judge/calibration';
import {
  labelBindingIssue,
  labelProgress,
  resolveCalibrationTargets,
  type CalibrationBenchRead,
} from '@/lib/judge/calibrationLabels';
import { getCalibrationLabel, listCalibrationLabels, upsertCalibrationLabel } from '@/lib/judge/calibration-labels-db';
import { currentStepBinding } from '@/lib/judge/stepBinding';
import { BANDS, RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { DIMENSIONS, deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact } from '@/lib/status/statusModel';

/**
 * /api/judge-calibration — the calibration bench (see `@/lib/judge/calibrationLabels`).
 *
 * GET returns the set `judge-run --calibrate` measures (`targets`: confirmed store labels that
 * still bind to the content on record + the remaining provisional seeds), the labels that no
 * longer bind (`excluded`, with why), `progress` toward the enforcement floor by band, and the
 * judge's calibration `standing` from the latest persisted run. `?catalogId&entityId&step` adds
 * that cell's label, rubric bar and — only once a human label exists — the last run's band.
 *
 * POST stores one label bound through the step-binding door: `contentHash` of the artifact on
 * record and the `RUBRIC_VERSION` in force. No artifact on record → 400; a `contentHash` the
 * client saw that no longer matches → 409 (the label would vouch for content nobody looked at).
 *
 * Measurement only: this route and its table are never read by acceptance or `statusModel`.
 */

function classOf(catalogId: string, step: string) {
  return deliverableClassOf(getStepFact(catalogId, step)?.deliverable ?? '', catalogId, step);
}

function cellRead(catalogId: string, entityId: string, step: string, run: CalibrationRun | null): CalibrationBenchRead['cell'] {
  const label = getCalibrationLabel(catalogId, entityId, step);
  const issue = label ? labelBindingIssue(label, currentStepBinding(catalogId, entityId, step)?.contentHash) : null;
  const scored = label && run && run.rubricVersion === RUBRIC_VERSION
    ? run.targets.find((t) => t.key === calibrationKey({ catalogId, entityId, step }))
    : undefined;
  const cls = classOf(catalogId, step);
  return {
    label,
    issue,
    judge: scored && scored.judge && scored.score !== null ? { band: scored.judge, score: scored.score } : null,
    rubric: {
      cls,
      dimensions: cls ? DIMENSIONS[cls].map((d) => d.key) : [],
      bands: { shippable: BANDS.shippable, placeholder: BANDS.placeholder },
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const labels = listCalibrationLabels();
    const contentNow: Record<string, string> = {};
    for (const l of labels) {
      const b = currentStepBinding(l.catalogId, l.entityId, l.step);
      if (b) contentNow[calibrationKey(l)] = b.contentHash;
    }
    const { targets, excluded } = resolveCalibrationTargets(CALIBRATION, labels, contentNow);
    const run = latestCalibrationRun();
    const verdict = evaluateCalibration(run, RUBRIC_VERSION);
    const q = req.nextUrl.searchParams;
    const [catalogId, entityId, step] = [q.get('catalogId'), q.get('entityId'), q.get('step')];
    const read: CalibrationBenchRead = {
      targets,
      excluded,
      progress: labelProgress(targets),
      standing: verdict.standing,
      message: verdict.message,
      ...(catalogId && entityId && step ? { cell: cellRead(catalogId, entityId, step, run) } : {}),
    };
    return apiSuccess(read);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-calibration GET failed', 500);
  }
}

const labelSchema = z.object({
  catalogId: z.string().min(1),
  entityId: z.string().min(1),
  step: z.string().min(1),
  label: z.enum(['fail', 'placeholder', 'shippable']),
  /** The `stepContentHash` of the content the operator was looking at, when the client knows it. */
  contentHash: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const parsed = labelSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid calibration label', 400, parsed.error.issues);
    const { catalogId, entityId, step, label, contentHash, note } = parsed.data;
    const binding = currentStepBinding(catalogId, entityId, step);
    if (!binding) {
      return apiError(`a calibration label must bind to content on record — ${catalogId}::${entityId}::${step} has no stored artifact`, 400);
    }
    if (!classOf(catalogId, step)) {
      return apiError(`${catalogId}::${step} has no judgeable deliverable class — --calibrate could never score this label`, 400);
    }
    if (contentHash && contentHash !== binding.contentHash) {
      return apiError('the content changed since you opened it — reload the evidence and label what is on record now', 409);
    }
    return apiSuccess(upsertCalibrationLabel({
      catalogId, entityId, step, label,
      contentHash: binding.contentHash, rubricVersion: RUBRIC_VERSION, ...(note ? { note } : {}),
    }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-calibration POST failed', 500);
  }
}
