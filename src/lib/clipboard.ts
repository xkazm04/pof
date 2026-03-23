/**
 * Safe clipboard write with fallback for non-secure contexts.
 *
 * The Clipboard API requires a secure context (HTTPS or localhost) and
 * document focus. This utility catches failures and returns a boolean so
 * callers can show accurate feedback instead of a false "Copied!" message.
 */

import { logger } from '@/lib/logger';

/**
 * Copy `text` to the system clipboard.
 * Returns `true` on success, `false` on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    logger.warn('Clipboard write failed — secure context or document focus required');
    return false;
  }
}
