/**
 * OLLAMA — the LOCAL eye.
 *
 * Recognition served by the vision model already resident on this machine's GPU. The point
 * is sovereignty and cost: an eye that runs where the pixels already are bills nobody and
 * ships nothing off the box.
 *
 * CONFIGURED means a host is set. That is deliberate, not a proxy for "the daemon is up":
 * the router's not-configured skip is the one honest way a local provider can be absent on
 * a machine that does not run one, and a set host with a dead daemon fails as a real call
 * error that re-routes. Both land in the trail; neither is silent.
 *
 * Two shapes carried from the working reference (`scripts/visual-gen/pof_vlm_batch.py` and
 * gravitone's imaging router), with their reasons:
 *   1. `stream: false` — one JSON body, not an SSE stream the seam would have to reassemble.
 *   2. `think: false` — reasoning VL models otherwise burn minutes thinking about a frame
 *      description before answering.
 */
import type { VisionAnswer } from '@/lib/anim-critique/vision';
import type { VisionProvider, VisionRequest } from '../types';

export interface OllamaOptions {
  /** Base address; default $OLLAMA_HOST. Empty/unset ⇒ the provider is not configured. */
  host?: string;
  /** The resident vision model; default $OLLAMA_VISION_MODEL, else a qwen VL tag. */
  model?: string;
  fetchImpl?: typeof fetch;
}

interface ChatResponse {
  model?: string;
  message?: { content?: string };
}

export function ollamaProvider(opts: OllamaOptions = {}): VisionProvider {
  const host = (opts.host ?? process.env.OLLAMA_HOST ?? '').replace(/\/+$/, '');
  const model = opts.model ?? process.env.OLLAMA_VISION_MODEL ?? 'qwen3.8:27b';
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    id: 'ollama',
    capabilities: ['recognize'],
    isConfigured: () => host !== '',

    async recognize(req: VisionRequest): Promise<VisionAnswer> {
      const res = await doFetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          messages: [{ role: 'user', content: req.prompt, images: req.images.map((i) => i.base64) }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`ollama ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
      }
      const body = (await res.json()) as ChatResponse;
      return {
        text: body.message?.content ?? '',
        // The daemon echoes the model that served; that is an ANSWERED attribution, not a
        // guess — the same discipline the Qwen chain seam already keeps.
        model: body.model ?? model,
        attribution: 'answered',
        fellBackFrom: [],
      };
    },
  };
}
