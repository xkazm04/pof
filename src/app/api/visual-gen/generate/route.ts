import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { runnerDispatchFor, runnerRefusal, type RunnerMode } from '@/lib/visual-gen/runner-dispatch';
import {
  routePromptShape,
  linearPropRefusal,
  linearPropOverridden,
  type PromptShapeRoute,
} from '@/lib/visual-gen/linear-prop-routing';
import {
  gateInputImage,
  parseVisionImage,
  summarizeInputGate,
  inputGateUnavailable,
  inputGateSkipped,
  inputGateRefusal,
  inputGateOverridden,
  type InputGateOutcome,
} from '@/lib/visual-gen/input-gate';
import { meshPromptFor } from '@/lib/media-prompts/meshPrompts';

/** TripoSR's marching-cubes grid: the default is 256, and the cost grows with the cube of it. */
const MC_RESOLUTION_MIN = 32;
const MC_RESOLUTION_MAX = 1024;

/** The first field of a parsed body that has the wrong shape, as a refusal. Null when all fit. */
function bodyShapeRefusal(body: Record<string, unknown>): string | null {
  for (const field of ['mode', 'providerId', 'imageDataUrl', 'prompt', 'assetClass', 'topology']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field} must be a string`;
  }
  const views = body.viewDataUrls;
  if (views != null) {
    if (typeof views !== 'object' || Array.isArray(views)) return 'viewDataUrls must be an object of view slot to data URL';
    if (Object.values(views).some((v) => v != null && typeof v !== 'string')) return 'viewDataUrls entries must be strings';
  }
  const { maxAttempts, mcResolution } = body;
  if (maxAttempts != null && !(Number.isInteger(maxAttempts) && (maxAttempts as number) >= 1)) {
    return 'maxAttempts must be a whole number of at least 1';
  }
  if (
    mcResolution != null
    && !(Number.isInteger(mcResolution) && (mcResolution as number) >= MC_RESOLUTION_MIN && (mcResolution as number) <= MC_RESOLUTION_MAX)
  ) {
    return `mcResolution must be a whole number from ${MC_RESOLUTION_MIN} to ${MC_RESOLUTION_MAX}`;
  }
  return null;
}

/**
 * POST /api/visual-gen/generate
 *
 * Image/text-to-3D pipeline. WHICH providers it can start, and how, is not written here:
 * it is `RUNNER_DISPATCH` (src/lib/visual-gen/runner-dispatch.ts) — local GPU runners
 * (hunyuan3d OFFICIAL, triposr MIT fallback, trellis2 textured) and cloud Tripo3D. Every
 * start returns a job (poll GET /api/visual-gen/generate/status?jobId=...). A provider or
 * mode the table cannot start is refused with the forge button's own
 * `providerExecution(...).reason`; MCP-backed providers (rodin) are pointed at
 * /api/blender-mcp/generate.
 *
 * Before either route, the SHAPE route refuses a subject whose geometry is fully
 * determined by its anchors (rope/cable/chain/wire) and points at
 * POST /api/visual-gen/linear-prop, which computes it for nothing;
 * `overrideShapeRoute: true` generates anyway. A prompt that merely mentions one still
 * generates, carrying an advisory on the 202 as `shapeRoute`.
 *
 * Every `image-to-3d` submit passes the Tier-0 INPUT gate before a provider job starts
 * (`gateInput: false` opts out, `overrideInputGate: true` generates through a fail). The
 * outcome rides on the 202 as `inputGate` — including when the gate could not run.
 */
export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const shapeRefusal = bodyShapeRefusal(parsed);
    if (shapeRefusal) return apiError(shapeRefusal, 400);
    const body = parsed as {
      mode?: string;
      providerId?: string;
      imageDataUrl?: string;
      prompt?: string;
      mcResolution?: number;
      assetClass?: string;
      maxAttempts?: number;
      topology?: string;
      /** Opt OUT of the Tier-0 input gate. Absent = gate runs (the credit-saving default). */
      gateInput?: boolean;
      /** Generate anyway despite a `fail` verdict. The outcome is still reported. */
      overrideInputGate?: boolean;
      /** Generate a linear prop (rope/cable/chain) anyway. The route is still reported. */
      overrideShapeRoute?: boolean;
      /**
       * `multiview-to-3d`: one base64 data URL per view slot. `front` is required.
       *
       * PoF has described a multi-view master reference set since `reference-roles.ts`
       * (role `multiview-master`; practice #7 on grid-combined views), but every 3D
       * dispatch path accepted exactly ONE image, so the side and back views were
       * generated and then thrown away and the provider went on guessing them.
       */
      viewDataUrls?: Partial<Record<'front' | 'left' | 'back' | 'right', string>>;
    };
    const {
      mode, providerId, imageDataUrl, prompt, mcResolution, assetClass, maxAttempts, topology,
      gateInput, overrideInputGate, overrideShapeRoute, viewDataUrls,
    } = body;

    // Quad topology is REACHABLE but refused, rather than silently unavailable. Tripo
    // delivers a quad request as FBX, and every consumer downstream of this route assumes
    // GLB: the GlbViewer, `pof_mesh_critique.py`'s trimesh load (which feeds the Tier-1
    // gate), and the UE .glb import. Writing FBX bytes to the .glb path this route builds
    // would make the extension lie to all three — `formatMismatchReason` in tripo-runner
    // exists to catch exactly that. Enabling quad is a format-conversion change, not a
    // flag, so the refusal names what has to happen first instead of pretending the
    // option does not exist.
    if (topology === 'quads') {
      return apiError(
        'quad topology is not wired: Tripo delivers a quad request as FBX, and this route writes a .glb consumed by the GlbViewer, the trimesh Tier-1 gate, and the UE .glb import. Enabling it needs a format-aware output path (or an FBX→GLB conversion) first — see tripo-runner formatMismatchReason.',
        400,
      );
    }
    if (topology !== undefined && topology !== 'triangles') {
      return apiError(`unknown topology "${topology}" — expected "triangles" or "quads"`, 400);
    }
    if (!mode || !providerId) return apiError('Missing required fields: mode, providerId', 400);

    /**
     * SHAPE route — the cheapest gate on this endpoint, and the place `routeShape`'s
     * credit-saving decision is finally cashed. It runs before the Tier-0 input gate on
     * purpose: a rope needs no vision call to be recognised as a rope, so a refusal here
     * costs nothing at all, not even the gate's own model call.
     *
     * Three outcomes, and only one refuses:
     *  - `procedural` → 400 naming /api/visual-gen/linear-prop (or, with
     *    `overrideShapeRoute`, generate and stamp the 202 as overridden);
     *  - `advise` → generate, with the advisory on the 202 — "a pirate holding a coiled
     *    rope" is a character, and refusing it over one word is the failure mode that
     *    gets a gate switched off;
     *  - `generate` → nothing is attached at all, so the happy path stays silent.
     */
    const promptRoute = routePromptShape(prompt);
    let shapeRoute: PromptShapeRoute | undefined =
      promptRoute.route === 'generate' ? undefined : promptRoute;
    const linearRefusal = linearPropRefusal(promptRoute);
    if (linearRefusal) {
      // The refusal string is for the caller; `details` is the RECORD. This is the one
      // outcome of the four that saves a credit, and it was the only one leaving no
      // structured trace - so nothing downstream could count deliberate diversions, or
      // tell one apart from a malformed request. Same shape the 202 carries in
      // `shapeRoute`, so one reader serves both.
      if (overrideShapeRoute !== true) return apiError(linearRefusal, 400, promptRoute);
      shapeRoute = linearPropOverridden(promptRoute);
    }

    // One table, one refusal vocabulary. A miss (no runner, or a mode the runner cannot
    // serve — e.g. multiview on the single-image local providers, which would otherwise
    // mesh only the front view and report a multiview run that never happened) refuses
    // with the same sentence the forge button shows. Ahead of the Tier-0 gate on purpose:
    // that gate is a paid vision call, and a submit no runner can start must not buy one.
    const dispatch = runnerDispatchFor(providerId);
    if (!dispatch || !dispatch.modes.includes(mode as RunnerMode)) {
      return apiError(runnerRefusal(providerId, mode), 400);
    }

    /**
     * Tier-0 INPUT gate — the symmetric twin of the Tier-1 mesh critique, and the ONE
     * place the input-gate lib's "a bad input caught here saves the generation credits"
     * claim is actually cashed. It runs BEFORE any `start*Job` call, so a refusal costs
     * nothing but the vision call it replaces.
     *
     * Three honest outcomes, and only one of them can refuse:
     *  - ran + `fail`   → 400 with the defects (or, with `overrideInputGate`, generate and
     *                     say it was overridden);
     *  - ran + pass/warn → generate, outcome attached to the 202;
     *  - could not run   → generate, stamped `unavailable`/`skipped`. A gate with no key
     *                     has measured nothing and must not condemn an image — the same
     *                     rule wave 12 gave the mesh critique (`unavailable → ungated`).
     * Submit-time only: never a paid vision call per keystroke.
     */
    let inputGate: InputGateOutcome | undefined;
    // Multiview is paid too: its FRONT view is the image the gate judges (one vision call);
    // whether the side views are gated as well is left open.
    const gatedImageUrl = mode === 'image-to-3d' ? imageDataUrl
      : mode === 'multiview-to-3d' ? viewDataUrls?.front
      : undefined;
    if (gatedImageUrl) {
      if (gateInput === false) {
        inputGate = inputGateSkipped();
      } else {
        const image = parseVisionImage(gatedImageUrl);
        inputGate = image
          ? summarizeInputGate(await gateInputImage(image, { subject: prompt?.trim().slice(0, 120) || undefined }))
          : inputGateUnavailable('the gated image is not a base64 image data URL the vision seam can read');
        const refusal = inputGateRefusal(inputGate);
        if (refusal) {
          if (overrideInputGate !== true) return apiError(refusal, 400);
          inputGate = inputGateOverridden(inputGate);
        }
      }
    }

    // The craft pack is composed here, after shape routing saw the RAW prompt, so the runner still
    // receives one prompt string. No pack for the class (or no prompt) leaves the prompt untouched.
    const sentPrompt = mode === 'text-to-3d' && prompt?.trim()
      ? meshPromptFor(assetClass, prompt) ?? prompt
      : prompt;
    const started = dispatch.start({
      mode: mode as RunnerMode, prompt: sentPrompt, imageDataUrl, viewDataUrls, assetClass, mcResolution, maxAttempts,
    });
    if (!started.ok) return apiError(started.error, 400);
    // `inputGate` is absent on text-to-3d (nothing to gate) and on multiview without a
    // single `imageDataUrl`; it rides along unchanged otherwise.
    return apiSuccess({ jobId: started.data.jobId, provider: providerId, mode, ...started.data.extras, inputGate, shapeRoute }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
