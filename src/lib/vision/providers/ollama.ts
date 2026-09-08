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
    // The daemon's dial is a BOOLEAN (`think`), not a three-step level, so only two of the
    // shared vocabulary's levels are honestly expressible here. Declaring both — rather than
    // claiming all three or none — is what lets the router TELL a caller who asked for
    // `medium` that it was served `low`, instead of the request being quietly ignored.
    effortLevels: ['low', 'high'],
    isConfigured: () => host !== '',

    async recognize(req: VisionRequest): Promise<VisionAnswer> {
      const base: Record<string, unknown> = {
        model,
        stream: false,
        // temperature 0 IS the determinism mechanism here — no seed is set, and gravitone
        // measured 100% enum stability across repeats on that alone. num_ctx is raised only
        // where the image count demands it; 8192 covers a single frame.
        options: { temperature: 0, num_ctx: 8192 },
        // Ollama enforces structured output natively, so a schema request is not advice.
        ...(req.schema ? { format: req.schema } : {}),
        messages: [{ role: 'user', content: req.prompt, images: req.images.map((i) => i.base64) }],
      };

      // `think` is spliced onto the FIRST attempt only. Reasoning VL models otherwise spend
      // minutes thinking about a frame description, so OFF is the default and `high` is the
      // opt-in — but a model with no thinking mode REJECTS the key outright with a 400, and
      // the only honest recovery is to drop it and ask again. Measured in gravitone's
      // probe.py; retrying on any other status would be guessing (a 5xx is the transport's
      // problem, a 401 will fail identically forever).
      const send = (body: Record<string, unknown>) =>
        doFetch(`${host}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      let res = await send({ ...base, think: req.effort === 'high' });
      if (!res.ok && res.status === 400) res = await send(base);
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
