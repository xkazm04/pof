import { GENERATION_PROVIDERS, type GenerationProvider } from '@/lib/blender-mcp/types';

/** The refusal sentence, built from the same list the guard checks. */
export const PROVIDER_REFUSAL_ERROR = `provider must be ${
  GENERATION_PROVIDERS.length > 1
    ? `${GENERATION_PROVIDERS.slice(0, -1).join(', ')} or ${GENERATION_PROVIDERS[GENERATION_PROVIDERS.length - 1]}`
    : GENERATION_PROVIDERS[0]
}`;

/**
 * Narrow a caller-supplied provider. The service indexes its command table with it, so an
 * unknown value used to fall through to Hunyuan3D on generate (a paid job, then a ledger
 * row no later call could resolve) and throw a TypeError (500) on status and import.
 */
export function isGenerationProvider(value: unknown): value is GenerationProvider {
  return typeof value === 'string' && (GENERATION_PROVIDERS as readonly string[]).includes(value);
}
