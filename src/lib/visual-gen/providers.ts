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
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'Open-source text/image-to-3D (MIT license). High quality but requires ~16GB VRAM.',
    vramGb: 16,
    isLocal: true,
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
    status: 'coming-soon',
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'Cloud-based fast 3D generation. Good for rapid prototyping. Paid API.',
    isLocal: false,
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
