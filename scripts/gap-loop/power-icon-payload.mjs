/**
 * Pure payload + naming logic for `power-icon.mjs` — the parts that decide WHAT gets
 * persisted and under WHICH filename, split out so they can be tested without a live
 * Leonardo generation or a Qwen-VL subprocess.
 *
 * Why a sibling `.mjs` and not a lib under `src/lib/visual-gen/`: `power-icon.mjs` is run
 * by bare `node` with no build step or loader, so it cannot import TypeScript. Keeping the
 * logic beside it means the script imports exactly what the test imports — there is no
 * second copy to drift. The one rule this file DUPLICATES from the app
 * (`src/lib/visual-gen/generated-icons.ts` → `iconSlug`) is pinned byte-for-byte against
 * the real lib by `src/__tests__/lib/visual-gen/power-icon-payload.test.ts`.
 *
 * The honesty contract this module exists to enforce:
 *   the artifact status is the GATE'S OWN verdict. A sub-threshold image is never persisted
 *   as `pass`, and a gate that did not run reports `pending` with the reason rather than
 *   defaulting to either `pass` or `fail`.
 */

/** score >= PASS_AT → pass. 7 is the proven gap-loop VLM gate line (mirrors input-gate.ts). */
export const PASS_AT = 7;

/** Collapse to the generator's id alphabet: runs of non-alphanumerics → one `_`, lowercased. */
function normalizeIconId(s) {
  return s.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

/**
 * The on-disk id a generated icon for `(catalogId, step)` carries. Byte-identical to
 * `iconSlug` in `src/lib/visual-gen/generated-icons.ts` — the rule EVERY consumer
 * (`useGeneratedImageAssets`, the `/api/visual-gen/icons` filter, `bind-icons`) matches on.
 */
export function iconSlug(catalogId, step) {
  return normalizeIconId(`${catalogId}__${step}`);
}

/** The `(catalog, step)` slug encoded in an icon filename (extension stripped). */
export function slugOfIconFile(name) {
  return normalizeIconId(name.replace(/\.[^.]+$/, ''));
}

/**
 * The filename a generated icon MUST be written under to be reachable by the step it was
 * generated for. Not try-indexed: only the candidate that is actually persisted into the
 * artifact belongs in the served library, so every file in `generated/icons/` is one a step
 * can show.
 */
export function iconFileName(catalogId, step, ext = 'jpg') {
  return `${iconSlug(catalogId, step)}.${ext}`;
}

/**
 * The gate's verdict, as ONE object both the artifact POST and the judge-verdict POST read —
 * so the two can no longer disagree (the artifact used to be hardcoded `pass` while the
 * verdict beside it was computed from the score).
 *
 * Three states, never two:
 *  - gate ran, score >= passAt  → `pass`
 *  - gate ran, score <  passAt  → `fail`
 *  - gate did NOT run (no score parsed: missing venv, VLM crash, no key) → `pending`,
 *    `verdict: null`. `pending` and not `deferred`: nothing was deliberately deferred to a
 *    later runtime gate, the quality of this image is simply UNKNOWN. And no judge verdict
 *    is posted at all — `judge_verdicts.verdict` is pass|fail, so any value there would be a
 *    claim the gate never made.
 *
 * @param {number|null|undefined} score raw VLM score 0-10, or null/undefined when absent
 * @param {number} [passAt]
 * @param {string} [gateError] what went wrong, when the gate did not produce a score
 */
export function gateOutcome(score, passAt = PASS_AT, gateError = '') {
  const ran = typeof score === 'number' && Number.isFinite(score);
  if (!ran) {
    const why = gateError ? ` (${gateError})` : '';
    return {
      ran: false,
      score: null,
      status: 'pending',
      verdict: null,
      reason:
        `VLM gate did not run — no score was produced by pof_vlm_critique.py${why}, so this ` +
        'image is UNVERIFIED: it is neither known good nor known bad. Re-run the gate before ' +
        'treating this step as powered.',
    };
  }
  const pass = score >= passAt;
  return {
    ran: true,
    score,
    status: pass ? 'pass' : 'fail',
    verdict: pass ? 'pass' : 'fail',
    reason: `Qwen-VL scored ${score}/10 against a ${passAt}/10 gate — ${pass ? 'at or above' : 'below'} the line.`,
  };
}

/**
 * The `/api/pipeline-artifacts` POST body. `status`/`reason` come from `gateOutcome`, never
 * from a literal. (The server re-grades registered steps and discards this status; for the
 * steps it cannot grade, this is the only truth the row will ever carry — which is exactly
 * why it must be the score's own verdict.)
 */
export function buildArtifactPayload({ catalogId, entityId, step, data, gate, tier = 'L1' }) {
  return {
    catalogId,
    entityId,
    step,
    data,
    status: gate.status,
    tier,
    reason: gate.reason,
  };
}

/**
 * The `/api/judge-verdicts` POST body, or `null` when the gate did not run (nothing to
 * report — see `gateOutcome`).
 */
export function buildVerdictPayload({ catalogId, entityId, step, gate, findings, model = 'qwen3-vl-4b' }) {
  if (!gate.ran || gate.verdict == null) return null;
  return {
    catalogId,
    entityId,
    step,
    judge: 'vlm',
    verdict: gate.verdict,
    score: Math.round(gate.score * 10),
    findings: findings.slice(0, 1500),
    model,
  };
}

/**
 * Every `(catalogId, step)` slug a generated icon COULD be shown under, from
 * `GET /api/catalog/pipelines` (`[{ catalogId, steps: string[] }]`).
 */
export function reachableIconSlugs(catalogs) {
  const out = new Set();
  for (const c of catalogs ?? []) {
    for (const step of c?.steps ?? []) out.add(iconSlug(c.catalogId, step));
  }
  return out;
}

/**
 * Icon filenames that no registered step can ever match — listed by
 * `/api/visual-gen/icons` and dead to every consumer. Reported, never deleted: renaming to
 * `iconFileName(catalogId, step)` is the reversible fix and it is the operator's call.
 */
export function unreachableIconNames(iconNames, reachable) {
  return (iconNames ?? []).filter((n) => !reachable.has(slugOfIconFile(n)));
}
