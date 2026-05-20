import { UI_TIMEOUTS } from '@/lib/constants';

declare global {
  interface Window {
    /** Set of terminal instanceIds that have registered their pof-cli-prompt
     *  listener and are ready to receive a dispatch. Maintained by
     *  CompactTerminal; read by dispatchPromptWhenReady. */
    __pofReadyTerminals?: Set<string>;
  }
}

/**
 * Dispatch a `pof-cli-prompt` event to the terminal identified by `tabId`.
 *
 * Replaces a fixed mount-delay timer that could fire before the terminal's
 * listener registered (the SP-A dispatch race). If the terminal is already in
 * the ready registry, dispatch immediately; otherwise wait for it to announce
 * `pof-cli-terminal-ready`. A safety-fallback timer dispatches anyway if the
 * terminal never announces — a loud-failure backstop, not the normal path.
 */
export function dispatchPromptWhenReady(tabId: string, prompt: string): void {
  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent('pof-cli-prompt', { detail: { tabId, prompt } }),
    );
  };

  if (window.__pofReadyTerminals?.has(tabId)) {
    dispatch();
    return;
  }

  let fired = false;
  const onReady = (e: Event) => {
    if ((e as CustomEvent).detail?.instanceId !== tabId) return;
    fired = true;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  };
  window.addEventListener('pof-cli-terminal-ready', onReady);

  setTimeout(() => {
    if (fired) return;
    window.removeEventListener('pof-cli-terminal-ready', onReady);
    dispatch();
  }, UI_TIMEOUTS.terminalReadyFallback);
}
