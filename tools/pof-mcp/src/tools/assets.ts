import {
  type ToolDef,
  reqStr, optStr, optNum, optBool, qs, obj, STR, NUM, BOOL, readOnly, writes } from './shared.js';

/**
 * The family that lets a headless agent PRODUCE, not only inspect.
 *
 * Before this file pof-mcp advertised fifty tools across five families and not one of
 * them made an asset. An agent driving PoF over MCP could list catalogs, read a step,
 * simulate combat and economy, scan and build the UE project, run its tests, submit an
 * artifact and drain a gate — and could not generate a mesh, look at one, or produce so
 * much as an icon. Every generation path was reachable only from the browser. So an
 * autonomous run could grade the pipeline and never move it.
 *
 * The four tools here mirror the loop a human does in the lab, in order:
 *
 *   generate → look → depict → list
 *
 * `pof_asset_generate` starts an image/text-to-3D job. `pof_asset_view_gate` orbits the
 * result in headless Blender and asks a vision model whether it is damaged — and, when
 * given the reference it was generated from, whether it is even the same object.
 * `pof_asset_icon` keeps one frame of that orbit as the entity's icon, so the 2D art
 * depicts the shipped mesh instead of illustrating it a second time. `pof_asset_library`
 * is the read: what already exists, so an agent does not regenerate an asset it has.
 *
 * Three properties this family must keep.
 *
 * 1. **Every one of them SPENDS.** Three of the four run a GPU, a paid provider, a
 *    Blender process or a vision quota; only the library read is free. They are
 *    annotated `writes` with `openWorld` where a third-party API is reached, so a host
 *    can put real friction in front of them — a family that could quietly burn Tripo
 *    credits under an auto-approve rule is worse than no family.
 * 2. **Jobs are polled, never awaited.** Generation and the view gate return a `jobId`
 *    because a provider round-trip and a Blender orbit both run far past an HTTP
 *    timeout; the status tools exist so an agent reads the outcome rather than assuming
 *    the 202 was the result. `pof_asset_icon` is the exception and says so: one orbit,
 *    no vision call, so it answers inside the request.
 * 3. **The gates are the point, not an option.** The generate route runs a Tier-0 input
 *    gate before it spends a credit and the view gate runs after; both are exposed here
 *    with their honest defaults, and the overrides are named so an agent that wants to
 *    generate through a refusal has to say so.
 */

/** Produce & inspect generated 3D/2D assets: generate, look at, depict, list. */
export const ASSET_TOOLS: ToolDef[] = [
  {
    name: 'pof_asset_generate',
    annotations: writes('Generate a 3D asset', { openWorld: true }),
    description:
      'Start an image-to-3D or text-to-3D generation job (providers: tripo3d cloud, hunyuan3d/triposr local GPU). SPENDS provider credits or GPU time. Returns a jobId — poll pof_asset_generate_status; the 202 does not mean a mesh exists. An image-to-3d submit passes the Tier-0 input gate first (single-subject/plain-background/canonical-pose) unless you opt out, because a bad input image is the cheapest failure to catch. `assetClass` selects the face budget AND how it is spent: some classes are generated unbudgeted and retopologized afterwards, because a generator asked for a low-poly building returns holes.',
    inputSchema: obj(
      {
        mode: { type: 'string', description: "'image-to-3d' | 'text-to-3d' | 'multiview-to-3d'." },
        providerId: { type: 'string', description: "'tripo3d' (cloud, needs TRIPO_API_KEY) | 'hunyuan3d' | 'triposr' (local GPU)." },
        prompt: { type: 'string', description: 'Subject text — required for text-to-3d.' },
        imageDataUrl: { type: 'string', description: 'base64 data URL — required for image-to-3d.' },
        assetClass: { type: 'string', description: 'character | weapon | prop | environment | modular-part. Omitted = graded class-blind; the response says so.' },
        gateInput: { type: 'boolean', description: 'false opts OUT of the Tier-0 input gate. Default (absent) = the gate runs.' },
        overrideInputGate: BOOL,
        overrideShapeRoute: BOOL,
        maxAttempts: NUM,
      },
      ['mode'],
    ),
    handler: async (args, pof) =>
      pof.post('/api/visual-gen/generate', {
        mode: reqStr(args, 'mode'),
        ...(optStr(args, 'providerId') ? { providerId: optStr(args, 'providerId') } : {}),
        ...(optStr(args, 'prompt') ? { prompt: optStr(args, 'prompt') } : {}),
        ...(optStr(args, 'imageDataUrl') ? { imageDataUrl: optStr(args, 'imageDataUrl') } : {}),
        ...(optStr(args, 'assetClass') ? { assetClass: optStr(args, 'assetClass') } : {}),
        // Threaded only when STATED: the route's own default for `gateInput` is "the
        // gate runs", and sending `undefined` as `false` would silently disable the
        // credit-saving check for every agent that never heard of it.
        ...(optBool(args, 'gateInput') !== undefined ? { gateInput: optBool(args, 'gateInput') } : {}),
        ...(optBool(args, 'overrideInputGate') !== undefined ? { overrideInputGate: optBool(args, 'overrideInputGate') } : {}),
        ...(optBool(args, 'overrideShapeRoute') !== undefined ? { overrideShapeRoute: optBool(args, 'overrideShapeRoute') } : {}),
        ...(optNum(args, 'maxAttempts') !== undefined ? { maxAttempts: optNum(args, 'maxAttempts') } : {}),
      }),
  },
  {
    name: 'pof_asset_generate_status',
    annotations: readOnly('Generation job status'),
    description:
      'Read a generation job: running/done/error, the written mesh path, and the Tier-1 structural critique (verts, faces, watertightness, components) once it finishes. Poll this — a generation job outlives the request that started it.',
    inputSchema: obj({ jobId: STR }, ['jobId']),
    example: { args: { jobId: 'unknown-job' }, note: 'An unknown jobId answers with a not-found, which is the shape an agent must handle while polling.' },
    handler: async (args, pof) => pof.get(`/api/visual-gen/generate/status${qs({ jobId: reqStr(args, 'jobId') })}`),
  },
  {
    name: 'pof_asset_view_gate',
    annotations: writes('Look at a generated mesh', { openWorld: true }),
    description:
      'LOOK at a generated mesh: orbit it in headless Blender and ask a vision model, per yaw, whether the geometry is damaged (holes, tears, fused parts, floaters, smeared texture). This catches what the structural critique cannot — an image-to-3D reconstructs the side it was shown and invents the rest, and a smeared back face is watertight, single-component and passes every number. Supply `referencePath` (the image the asset was generated FROM) to additionally ask whether the mesh is even the same OBJECT as the reference; that answer is reported beside the damage verdict and never folded into it. Spends one vision call per yaw, plus one more for the conformance question. Returns a jobId — poll pof_asset_view_gate_status.',
    inputSchema: obj(
      {
        meshPath: { type: 'string', description: 'Absolute path to the .glb to inspect.' },
        subject: { type: 'string', description: 'What the asset is meant to be, so "wrong shape" is judgeable.' },
        referencePath: { type: 'string', description: 'The reference image the asset was generated FROM. Present = the conformance question is asked; absent = it is not asked (reported as not-requested, which is not a failure).' },
        views: { type: 'number', description: 'Yaws to render (2-16, default 6). Each yaw is a vision call.' },
        resolution: NUM,
      },
      ['meshPath'],
    ),
    handler: async (args, pof) =>
      pof.post('/api/visual-gen/view-gate', {
        meshPath: reqStr(args, 'meshPath'),
        ...(optStr(args, 'subject') ? { subject: optStr(args, 'subject') } : {}),
        ...(optStr(args, 'referencePath') ? { referencePath: optStr(args, 'referencePath') } : {}),
        ...(optNum(args, 'views') !== undefined ? { views: optNum(args, 'views') } : {}),
        ...(optNum(args, 'resolution') !== undefined ? { resolution: optNum(args, 'resolution') } : {}),
      }),
  },
  {
    name: 'pof_asset_view_gate_status',
    annotations: readOnly('View-gate job status'),
    description:
      'Read a view-gate job: the per-yaw verdicts and the aggregate (fail > unmeasured > warn > pass — a view nobody could judge is never a pass), the reference-conformance answer (match/drift/mismatch/not-requested) when one was asked for, and the advisory colour-coherence grade for a multi-member kit.',
    inputSchema: obj({ jobId: STR }, ['jobId']),
    example: { args: { jobId: 'unknown-job' }, note: 'An unknown jobId answers with a not-found — the shape an agent must handle while polling.' },
    handler: async (args, pof) => pof.get(`/api/visual-gen/view-gate/status${qs({ jobId: reqStr(args, 'jobId') })}`),
  },
  {
    name: 'pof_asset_icon',
    annotations: writes('Render an icon from a mesh', { idempotent: true }),
    description:
      "Render the item icon FROM a mesh instead of generating a second illustration of it: one headless Blender orbit, one frame kept, written into the icon library under the name every consumer already matches on, with a provenance sidecar naming the mesh and the yaw. Use this whenever an entity already has a GLB — the generated 2D art never sees the mesh, so an entity's icon and its asset are free to depict different objects. Costs no provider credits and no vision call, and answers inside the request rather than returning a job.",
    inputSchema: obj(
      {
        meshPath: { type: 'string', description: 'Absolute path to the .glb to photograph.' },
        catalogId: { type: 'string', description: 'Catalog the icon belongs to — half of the name consumers match on.' },
        step: { type: 'string', description: 'Step label the icon is for.' },
        entityId: { type: 'string', description: "Entity id when the icon is for one entity; omitted writes the catalog-wide per-step icon." },
        heroYaw: { type: 'number', description: 'Camera yaw for the kept frame (default 45, the three-quarter item-icon angle). An off-grid yaw is approximated and the response says so.' },
        resolution: NUM,
      },
      ['meshPath', 'catalogId', 'step'],
    ),
    handler: async (args, pof) =>
      pof.post('/api/visual-gen/icon-from-mesh', {
        meshPath: reqStr(args, 'meshPath'),
        catalogId: reqStr(args, 'catalogId'),
        step: reqStr(args, 'step'),
        ...(optStr(args, 'entityId') ? { entityId: optStr(args, 'entityId') } : {}),
        ...(optNum(args, 'heroYaw') !== undefined ? { heroYaw: optNum(args, 'heroYaw') } : {}),
        ...(optNum(args, 'resolution') !== undefined ? { resolution: optNum(args, 'resolution') } : {}),
      }),
  },
  {
    name: 'pof_asset_library',
    annotations: readOnly('Generated asset library'),
    description:
      'List the generated meshes already on disk across every provider directory, newest first, each carrying the provider that made it. Read this BEFORE generating: the cheapest generation is the one already paid for.',
    inputSchema: obj({}),
    example: { args: {}, note: 'Lists every generated mesh; an absent directory answers with an empty list, not an error.' },
    handler: async (_args, pof) => pof.get('/api/visual-gen/assets'),
  },
];
