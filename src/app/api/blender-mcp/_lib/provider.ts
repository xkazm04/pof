import type { GenerationProvider } from '@/lib/blender-mcp/types';

const PROVIDERS: readonly GenerationProvider[] = ['hyper3d', 'hunyuan3d'];

/**
 * Narrow a caller-supplied provider. The service indexes its command table with it, so an
 * unknown value used to fall through to Hunyuan3D on generate (a paid job, then a ledger
 * row no later call could resolve) and throw a TypeError (500) on status and import.
 */
export function isGenerationProvider(value: unknown): value is GenerationProvider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}
