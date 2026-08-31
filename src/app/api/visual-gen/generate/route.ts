import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { polycountFor, resolveAssetClass } from '@/lib/visual-gen/polycount-presets';
import { providerFaceLimit } from '@/lib/visual-gen/face-budget';
import { tripoModelFor } from '@/lib/visual-gen/tripo-models';
import { hunyuanModelFor } from '@/lib/visual-gen/hunyuan-models';
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

/**
 * POST /api/visual-gen/generate
 *
 * Image/text-to-3D pipeline. Two routes behind one endpoint:
 *  - LOCAL (open-source, GPU): 'hunyuan3d' (OFFICIAL, ~360K-face) + 'triposr' (MIT
 *    fallback) — image-to-3d only; decode the uploaded image, write it server-side,
 *    start a job.
 *  - CLOUD (Tripo3D REST API): 'tripo3d' — text-to-3d OR image-to-3d, no local VRAM,
 *    PBR-textured output (free tier is non-commercial). Needs env TRIPO_API_KEY.
 * Both start a job (poll GET /api/visual-gen/generate/status?jobId=...). MCP-backed
 * providers (rodin) go through /api/blender-mcp/generate, not here.
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
  try {
    const body = (await request.json()) as {
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
    };
    const {
      mode, providerId, imageDataUrl, prompt, mcResolution, assetClass, maxAttempts, topology,
      gateInput, overrideInputGate, overrideShapeRoute,
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
    // The preset budget is authored in TRIANGLES; `providerFaceLimit` converts it to the
    // number the provider's `face_limit` actually counts (halved for quad topology).
    const gradedAs = resolveAssetClass(assetClass).gradedAs;
    const triangleBudget = assetClass ? polycountFor(assetClass)?.faceLimit : undefined;
    const faceLimit = triangleBudget !== undefined
      ? providerFaceLimit({ triangleBudget, topology: 'triangles' })
      : undefined;

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
    const shapeRefusal = linearPropRefusal(promptRoute);
    if (shapeRefusal) {
      if (overrideShapeRoute !== true) return apiError(shapeRefusal, 400);
      shapeRoute = linearPropOverridden(promptRoute);
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
    if (mode === 'image-to-3d' && imageDataUrl) {
      if (gateInput === false) {
        inputGate = inputGateSkipped();
      } else {
        const image = parseVisionImage(imageDataUrl);
        inputGate = image
          ? summarizeInputGate(await gateInputImage(image, { subject: prompt?.trim().slice(0, 120) || undefined }))
          : inputGateUnavailable('imageDataUrl is not a base64 image data URL the vision seam can read');
        const refusal = inputGateRefusal(inputGate);
        if (refusal) {
          if (overrideInputGate !== true) return apiError(refusal, 400);
          inputGate = inputGateOverridden(inputGate);
        }
      }
    }

    const outFor = (id: string) => {
      const stamp = Date.now();
      const outDir = join(process.cwd(), 'generated', id).replace(/\\/g, '/');
      mkdirSync(outDir, { recursive: true });
      return { stamp, outputPath: join(outDir, `${stamp}.glb`).replace(/\\/g, '/') };
    };
    const imageToFile = (id: string, stamp: number) => {
      const img = imageDataUrl ? parseImageDataUrl(imageDataUrl) : null;
      if (!img) return null;
      const inPath = join(tmpdir(), `pof_${id}_in_${stamp}.${img.ext}`).replace(/\\/g, '/');
      writeFileSync(inPath, img.buffer);
      return inPath;
    };

    if (providerId === 'hunyuan3d' || providerId === 'triposr') {
      if (mode !== 'image-to-3d') return apiError(`${providerId} supports image-to-3d only`, 400);
      if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
      const { stamp, outputPath } = outFor(providerId);
      const inPath = imageToFile(providerId, stamp);
      if (!inPath) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);

      // `assetClass` is OPTIONAL and its default is stated, never guessed: absent (or
      // unrecognised) input grades class-blind and `gradedAs` says so, because promoting
      // a missing class to a "typical" one would fail an assembled character against a
      // prop's component budget. Until this arrived, the local stores graded every mesh
      // against the class-blind 200k ceiling with nothing anywhere admitting it.
      // Never leave the Hunyuan model unstated either: without this the model was
      // decided by an argparse default inside pof_hunyuan.py and no mesh was ever
      // attributable to a tier. `hunyuanModelFor` states the model that has actually
      // been running — and reports `audited: false`, because unlike Tripo's pin no PoF
      // arena has ever graded a Hunyuan mesh (`generated/hunyuan3d/` is empty).
      const jobId = providerId === 'hunyuan3d'
        ? startHunyuanJob({ imagePath: inPath, outputPath, assetClass, model: hunyuanModelFor(assetClass).model })
        : startTriposrJob({ imagePath: inPath, outputPath, mcResolution, fidelity: true, assetClass });
      return apiSuccess({ jobId, provider: providerId, mode, gradedAs: resolveAssetClass(assetClass).gradedAs, inputGate, shapeRoute }, 202);
    }

    if (providerId === 'tripo3d') {
      const { stamp, outputPath } = outFor('tripo3d');
      // Never leave model_version unset — the character-pipeline arena graded the silent
      // account default a FAIL. `tripoModelFor` pins the one model it graded PASS, with
      // the texture quality both recorded pass recipes call for.
      const pin = tripoModelFor(assetClass);
      const tripoPin = { modelVersion: pin.modelVersion, textureQuality: pin.textureQuality };
      if (mode === 'text-to-3d') {
        if (!prompt?.trim()) return apiError('Missing prompt for text-to-3d', 400);
        const jobId = startTripoJob({ mode: 'text-to-3d', prompt, outputPath, pbr: true, faceLimit, assetClass, maxAttempts, ...tripoPin });
        // No `inputGate` here on purpose: a text-to-3d submit has no input image to gate.
        return apiSuccess({ jobId, provider: 'tripo3d', mode, gradedAs, shapeRoute }, 202);
      }
      if (mode === 'image-to-3d') {
        if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
        const inPath = imageToFile('tripo3d', stamp);
        if (!inPath) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);
        const jobId = startTripoJob({ mode: 'image-to-3d', imagePath: inPath, outputPath, pbr: true, faceLimit, assetClass, maxAttempts, ...tripoPin });
        return apiSuccess({ jobId, provider: 'tripo3d', mode, gradedAs, inputGate, shapeRoute }, 202);
      }
      return apiError('tripo3d supports text-to-3d and image-to-3d', 400);
    }

    return apiError(`Provider "${providerId}" is not wired for local generation (MCP providers use /api/blender-mcp/generate)`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
