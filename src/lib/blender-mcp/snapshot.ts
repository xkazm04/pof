import { tryApiFetch } from '@/lib/api-utils';
import { ok, err, type Result } from '@/types/result';

/**
 * Shared viewport-snapshot helpers for the Blender MCP surface.
 *
 * Single source of truth for turning the addon's base64 PNG screenshot into a
 * displayable object URL, plus the fetch-and-decode round trip. Reused by the
 * manual {@link ViewportPreview} capture button and the Asset Browser's
 * auto-capture-after-import flow so they stay byte-identical.
 */

/** Decode a base64 PNG payload into an object URL (browser-only). */
export function base64PngToObjectUrl(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  return URL.createObjectURL(blob);
}

/**
 * Capture the current Blender viewport and return an object URL for the PNG.
 * Errors (bridge offline, empty payload, decode failure) come back as `err`
 * so callers can surface or ignore them without a try/catch.
 */
export async function captureViewportSnapshot(): Promise<Result<string, string>> {
  const result = await tryApiFetch<{ screenshot: string }>(
    '/api/blender-mcp/screenshot',
  );
  if (!result.ok) return err(result.error || 'Capture failed');
  if (!result.data.screenshot) return err('No screenshot returned from Blender');
  try {
    return ok(base64PngToObjectUrl(result.data.screenshot));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Decode failed');
  }
}
