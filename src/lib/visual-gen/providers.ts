/**
 * Registry of 3D generation providers.
 * Free providers are functional; paid providers show "Coming Soon" placeholders.
 */

export type ProviderStatus = 'free' | 'coming-soon' | 'paid';
export type GenerationMode = 'text-to-3d' | 'image-to-3d';

export interface GenerationProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  modes: GenerationMode[];
  description: string;
  /** Approximate VRAM requirement for local providers */
  vramGb?: number;
  /** Whether the provider runs locally (vs cloud API) */
  isLocal: boolean;
  /** Whether this provider is backed by Blender MCP integration */
  mcpBacked?: boolean;
  /** Whether a PoF runner can actually execute this provider end-to-end today
   *  (vs being descriptive metadata only). */
  runnerBacked?: boolean;
  /** The default image-to-3D provider used across PoF. Exactly one provider should
   *  carry this. */
  official?: boolean;
}

export const GENERATION_PROVIDERS: GenerationProvider[] = [
  {
    id: 'triposr',
    name: 'TripoSR',
    status: 'free',
    modes: ['image-to-3d'],
    description: 'Open-source image-to-3D (MIT — the COMMERCIAL-SAFE / fast fallback to the official Hunyuan3D provider). Runs locally on ~6GB VRAM, <1s, ~44K-face meshes. src/lib/visual-gen/triposr-runner.ts drives scripts/visual-gen/pof_triposr.py (set POF_TRIPOSR_ROOT). Lower detail than Hunyuan; use when an MIT license or sub-second speed matters more than geometry quality.',
    vramGb: 6,
    isLocal: true,
    runnerBacked: true,
  },
  {
    id: 'trellis2',
    name: 'TRELLIS.2',
    status: 'free',
    // IMAGE ONLY. The old entry also claimed text-to-3d; microsoft/TRELLIS.2-4B ships
    // `Trellis2ImageTo3DPipeline` and no text pipeline, so the claim made this the
    // default pick for text-to-3d (`defaultProviderForMode`) on a mode it cannot serve.
    modes: ['image-to-3d'],
    description: 'Open-source image-to-3D (Microsoft code + weights MIT). The ONLY local provider that emits GEOMETRY **AND** PBR TEXTURE in one pass; Hunyuan3D and TripoSR are shape-only, so their texturing is a separate Leonardo-PBR/rasterizer stage. Accepts a NATIVE face budget (o_voxel `decimation_target`), so an asset class steers generation instead of being enforced by a later decimate pass. src/lib/visual-gen/trellis-runner.ts drives scripts/visual-gen/pof_trellis.py. Linux-only upstream (5 CUDA extensions) — on Windows set POF_TRELLIS_WSL to run it in WSL against the same GPU. LICENCE IS NOT MIT END-TO-END: every generation config conditions on `facebook/dinov3-vitl16-pretrain-lvd1689m`, a GATED repo under Meta\'s custom "DINOv3 License", so this is NOT the commercial-safe route it looks like from the MIT badge — TripoSR (MIT throughout) remains the only unencumbered local option. Running it at all needs an HF account that has accepted the DINOv3 terms plus HF_TOKEN in the environment; without one the first run fails with a 401 on a gated repo (measured 2026-08-21).',
    // 24GB at fp16 (Microsoft state >=24GB, verified on A100/H100), NOT the 16 the old
    // entry claimed. A 24GB card is exactly at the line once the desktop takes its cut,
    // so the texture bake is the stage that OOMs first — drop `textureSize` before VRAM.
    vramGb: 24,
    isLocal: true,
    runnerBacked: true,
  },
  {
    id: 'hunyuan3d',
    name: 'Hunyuan3D',
    status: 'free',
    modes: ['image-to-3d'],
    description: 'OFFICIAL PoF image-to-3D provider. Local Hunyuan3D-2 shape model (Hunyuan3DDiTFlowMatchingPipeline) via src/lib/visual-gen/hunyuan-runner.ts → scripts/visual-gen/pof_hunyuan.py (set POF_HUNYUAN_ROOT; venv = POF_HUNYUAN_VENV or the shared TripoSR venv). ~6GB VRAM, ~31s, ~360K-face high-detail meshes — an ~8x geometry jump over TripoSR. SHAPE ONLY (texturing is a separate custom-rasterizer / Leonardo-PBR step). NON-COMMERCIAL license — TripoSR is the MIT/commercial-safe fallback. Pairs with the Leonardo GPT Image 2 (RENDER_3D) 2D front + the CLIP/geometry/Qwen-VL critique tiers.',
    vramGb: 6,
    isLocal: true,
    runnerBacked: true,
    official: true,
  },
  {
    id: 'meshy',
    name: 'Meshy',
    status: 'coming-soon',
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'Cloud-based AI 3D generation. High quality, game-ready topology. Paid API.',
    isLocal: false,
  },
  {
    id: 'tripo3d',
    name: 'Tripo3D',
    status: 'free',
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'Cloud 3D generation (Tripo REST API) — the CLOUD route next to the local open-source route. Runs via src/lib/visual-gen/tripo-runner.ts (upload → create task → poll → download .glb); needs env TRIPO_API_KEY (free tier = 200 credits/mo, 1 concurrent task). Adds TEXT-to-3D (the local Hunyuan/TripoSR route is image-only) and PBR-textured image-to-3D with no local VRAM. FREE-TIER OUTPUT IS NON-COMMERCIAL (CC BY 4.0) — like Hunyuan3D; TripoSR (MIT) stays the commercial-safe fallback.',
    isLocal: false,
    runnerBacked: true,
  },
  {
    id: 'rodin',
    name: 'Rodin (Hyper3D)',
    status: 'free',
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'High-fidelity 3D generation with PBR textures via Blender MCP.',
    isLocal: false,
    mcpBacked: true,
  },
];

export function getProviderById(id: string): GenerationProvider | undefined {
  return GENERATION_PROVIDERS.find((p) => p.id === id);
}

/** How (or whether) PoF can actually execute a provider for one mode. */
export interface ProviderExecution {
  /** True when some code path in PoF drives this provider end-to-end for `mode`. */
  executable: boolean;
  /** Which path drives it. Absent when nothing does. */
  path?: 'runner' | 'mcp';
  /** Why it cannot run. Always present when `executable` is false. */
  reason?: string;
}

/**
 * Resolve a provider's execution path for one mode. Pure, and the single source of
 * truth for "can this be submitted?".
 *
 * Registry membership is NOT capability. `trellis2` and `meshy` are descriptive
 * entries with no runner behind them, and submitting to one used to enqueue a job
 * that nothing would ever update — pending forever, no poller, no error, a live
 * elapsed clock for the rest of the session. A provider with no execution path is
 * now refusable with the reason instead of silently swallowing a submit.
 */
export function providerExecution(provider: GenerationProvider, mode: GenerationMode): ProviderExecution {
  if (!provider.modes.includes(mode)) {
    return {
      executable: false,
      reason: `${provider.name} does not support ${mode} (it supports ${provider.modes.join(', ')}).`,
    };
  }
  // MCP-backed providers execute through the Blender bridge. Whether the bridge is
  // CONNECTED right now is a separate, recoverable condition the caller checks —
  // the execution path itself exists.
  if (provider.mcpBacked) return { executable: true, path: 'mcp' };
  if (provider.runnerBacked) return { executable: true, path: 'runner' };
  return {
    executable: false,
    reason:
      `No runner configured for this provider on this machine — ${provider.name} is registry ` +
      `metadata only${provider.status === 'coming-soon' ? ' (not implemented yet)' : ''}. ` +
      `Pick a provider marked Runner or MCP.`,
  };
}

/**
 * The provider a fresh panel should preselect for `mode`: the official one when it
 * can run that mode, else the first registry entry that can, else `undefined` —
 * which the UI must report as "nothing here can run this mode" rather than falling
 * back to whatever happens to be listed first. Pure.
 *
 * The old fallback was `providersForMode[0]`, which for the DEFAULT text-to-3d mode
 * resolved to `trellis2` — the metadata-only entry — making the default first click
 * produce a job that never resolved.
 */
export function defaultProviderForMode(mode: GenerationMode): GenerationProvider | undefined {
  const runnable = GENERATION_PROVIDERS.filter((p) => providerExecution(p, mode).executable);
  return runnable.find((p) => p.official) ?? runnable[0];
}

export function getAvailableProviders(mode: GenerationMode): GenerationProvider[] {
  return GENERATION_PROVIDERS.filter((p) => p.modes.includes(mode));
}

export function getFreeProviders(): GenerationProvider[] {
  return GENERATION_PROVIDERS.filter((p) => p.status === 'free');
}

/** The default image-to-3D provider used across PoF (Hunyuan3D). Falls back to the
 *  first runner-backed provider if none is flagged official. */
export function getOfficialProvider(): GenerationProvider {
  return GENERATION_PROVIDERS.find((p) => p.official)
    ?? GENERATION_PROVIDERS.find((p) => p.runnerBacked)
    ?? GENERATION_PROVIDERS[0];
}
