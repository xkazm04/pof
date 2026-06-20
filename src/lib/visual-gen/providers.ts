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
}

export const GENERATION_PROVIDERS: GenerationProvider[] = [
  {
    id: 'triposr',
    name: 'TripoSR',
    status: 'free',
    modes: ['image-to-3d'],
    description: 'Open-source image-to-3D (MIT). Runs locally on ~6GB VRAM. WIRED: the first executable generator in the zero-budget local pipeline — src/lib/visual-gen/triposr-runner.ts drives scripts/visual-gen/pof_triposr.py (set POF_TRIPOSR_ROOT). Low quality by design; the seam lets a cloud provider (Tripo/Meshy/Rodin) slot in later.',
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
    modes: ['text-to-3d', 'image-to-3d'],
    description: 'Open-source 3D generation from Tencent (Apache 2.0). Good quality, ~12GB VRAM.',
    vramGb: 12,
    isLocal: true,
    mcpBacked: true,
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
