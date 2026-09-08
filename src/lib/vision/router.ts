/**
 * THE CHOKEPOINT — every image-recognition call in the app enters here.
 *
 * Callers ask for a CAPABILITY. That is the whole design: which vendor serves the eyes is
 * ONE table in this file, and changing it is a one-line edit rather than a search across
 * `visual-gen/{input-gate,view-critique,style-dna,footage-gate,reference-conformance}` and
 * every route that judges a frame.
 *
 * THE INVARIANT: **no elimination is silent.** A candidate can drop out four ways — it
 * lacks the capability, it cannot honour a field of THIS request, it is not configured on
 * this machine, or it was called and failed — and every one lands in `trail`, which reaches
 * the caller two ways: on the answer when a later provider served, and in the thrown error
 * when the whole chain came up empty.
 */
import { EFFORT_ORDER } from './types';
import type {
  Elimination,
  VisionEffort,
  VisionCapability,
  VisionProvider,
  VisionProviderId,
  VisionRequest,
  RoutedVisionAnswer,
} from './types';

/**
 * How long to wait for ONE eye before giving up on it, in ms.
 *
 * DELIBERATELY GENEROUS (operator policy, 2026-09-08). This app runs on one machine for one
 * person, latency is a secondary factor, and waiting for a correct answer beats racing for a
 * fast one. The local eye was measured at 4.4-7.2 s warm and 42-118 s while the UE editor held
 * the GPU, so anything in the tens of seconds would cut off answers that were about to arrive.
 *
 * The asymmetry that sets the floor: a timeout here does not merely lose a call — it is an
 * elimination, so the router RE-ROUTES to the next eye, which is metered. Cutting the free
 * local eye short therefore converts a slow $0 answer into a paid one, silently. The ceiling
 * exists to catch a HUNG daemon and nothing faster than that.
 *
 * `POF_VISION_TIMEOUT_MS` overrides it for an operator who wants a tighter leash.
 */
export const DEFAULT_VISION_TIMEOUT_MS = 900_000; // 15 minutes

function timeoutFor(provider: VisionProvider): number {
  const env = Number(process.env.POF_VISION_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  return provider.timeoutMs ?? DEFAULT_VISION_TIMEOUT_MS;
}

/**
 * Race a call against its ceiling. The rejection carries the budget so the trail says what was
 * waited for, not merely that something did not arrive.
 *
 * The limitation, stated rather than hidden: this abandons the promise, it does not cancel the
 * work. Providers that own their transport (see `providers/ollama.ts`) also receive an
 * AbortSignal and really do stop; a provider calling through a vendor SDK may keep running to
 * completion in the background. Abandoning is still correct — the alternative is a route
 * handler that never returns — but nobody should read this as cancellation.
 */
async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Which environment's plan applies. */
export type VisionEnv = 'dev' | 'prod';

/**
 * Provider preference per capability, most-preferred first.
 *
 * LOCAL FIRST (operator policy, 2026-09-08): the resident eye leads wherever it is
 * configured — it bills nobody and no pixel leaves the box — and the metered eyes stay as
 * re-route targets, so a machine with no daemon keeps working and the skip lands in `trail`
 * like every other elimination.
 *
 * This order is a PERMISSION, not yet a measurement. The registry's `model-routing` path
 * separates the two: an operator policy over which providers an installation may use is not
 * a benchmark result and does not have to cite one. What still has to be measured is
 * whether the local eye CAN serve each use case — that is the arena, and until a capability
 * has been through it, the ordering here is a stated preference and nothing more.
 */
const PLAN: Record<VisionEnv, Record<VisionCapability, VisionProviderId[]>> = {
  dev: { recognize: ['ollama', 'qwen-cloud', 'gemini'] },
  prod: { recognize: ['ollama', 'qwen-cloud', 'gemini'] },
};

/** Who would answer this capability right now, in order. Exported so a diagnostics surface
 *  reports the same truth the router acts on rather than restating it. */
export function planFor(cap: VisionCapability, env: VisionEnv = 'dev'): VisionProviderId[] {
  return PLAN[env][cap];
}

/**
 * A caller's steer. The two halves have deliberately DIFFERENT strength, and the asymmetry
 * is the design: `prefer` only reorders and is dropped when it cannot be honoured (the
 * caller asked for a better first try, not for a failure); `avoid` REMOVES, and when
 * removal empties the chain the request fails with "no alternative" rather than quietly
 * serving the avoided provider — because the one caller who sends an avoid is a caller who
 * was just refused, and a re-route that can land back there is not a re-route.
 */
export interface VisionSteer {
  prefer?: VisionProviderId;
  avoid?: VisionProviderId[];
}

export interface RecognizeOptions {
  /** Explicit provider set (tests, and any caller assembling its own roster). */
  providers?: VisionProvider[];
  /** Explicit plan order, overriding the table (tests, diagnostics). */
  plan?: VisionProviderId[];
  env?: VisionEnv;
  steer?: VisionSteer;
}

/** Apply a steer to the plan. Pure — the ordering rule is testable without a provider. */
export function steerPlan(plan: VisionProviderId[], steer: VisionSteer = {}): VisionProviderId[] {
  const avoided = new Set(steer.avoid ?? []);
  const kept = plan.filter((id) => !avoided.has(id));
  if (!steer.prefer || !kept.includes(steer.prefer)) return kept;
  return [steer.prefer, ...kept.filter((id) => id !== steer.prefer)];
}

function eliminate(provider: VisionProviderId, kind: Elimination['kind'], detail: string): Elimination {
  return { provider, kind, detail };
}

/**
 * Route one recognition request. Walks the plan, recording every drop-out, and returns the
 * first real answer annotated with who served it and what did not.
 */
export async function recognize(
  req: VisionRequest,
  opts: RecognizeOptions = {},
): Promise<RoutedVisionAnswer> {
  const planned = opts.plan ?? planFor('recognize', opts.env ?? 'dev');
  const order = steerPlan(planned, opts.steer);
  if (order.length === 0) {
    throw new Error(
      `no alternative: every provider in the plan (${planned.join(', ')}) was excluded by the caller's avoid steer`,
    );
  }
  const byId = new Map((opts.providers ?? []).map((p) => [p.id, p]));
  const trail: Elimination[] = [];

  for (const id of order) {
    const provider = byId.get(id);
    if (!provider) continue;
    if (!provider.capabilities.includes('recognize')) {
      trail.push(eliminate(id, 'no-capability', `${id} does not serve recognize`));
      continue;
    }
    if (!provider.isConfigured()) {
      trail.push(eliminate(id, 'not-configured', `${id} is not configured on this machine`));
      continue;
    }
    const blocked = provider.cannotHonour?.(req) ?? null;
    if (blocked) {
      trail.push(eliminate(id, 'unsupported-request', blocked));
      continue;
    }
    const effortServed = resolveEffort(req.effort, provider.effortLevels);
    let answer;
    try {
      answer = await withTimeout(
        (signal) => provider.recognize({ ...req, ...(effortServed ? { effort: effortServed } : {}) }, signal),
        timeoutFor(provider),
      );
    } catch (e) {
      trail.push(eliminate(id, 'call-failed', e instanceof Error ? e.message : String(e)));
      continue;
    }
    // An empty answer is a REFUSAL, not a success with no content. Read the other way, the
    // caller gets nothing — silently, with a green status attached — instead of the
    // re-route to a provider that could have served them.
    if (!answer.text.trim()) {
      trail.push(eliminate(id, 'call-failed', 'returned an empty answer (read as a refusal)'));
      continue;
    }
    return {
      ...answer,
      provider: id,
      trail,
      ...(effortServed ? { effortServed } : {}),
      effortDowngraded: req.effort !== undefined && effortServed !== req.effort,
    };
  }

  throw new Error(`no vision provider could serve this request — ${describeTrail(trail)}`);
}

/**
 * The effort a provider will actually serve for a requested level. Pure.
 *
 * Picks the highest level the provider supports that does not EXCEED the request (asking for
 * `high` on a provider that only has `low` gets `low`, not a surprise bill); if the provider
 * cannot go that low either, it serves its cheapest. Returns undefined when the caller asked
 * for nothing, or when the provider has no effort knob at all — in which case the router
 * still reports the mismatch rather than letting an ignored field pass for an honoured one.
 */
export function resolveEffort(
  requested: VisionEffort | undefined,
  supported: readonly VisionEffort[] | undefined,
): VisionEffort | undefined {
  if (!requested || !supported || supported.length === 0) return undefined;
  const wanted = EFFORT_ORDER.indexOf(requested);
  const atOrBelow = supported.filter((l) => EFFORT_ORDER.indexOf(l) <= wanted);
  const pool = atOrBelow.length > 0 ? atOrBelow : supported;
  return pool.reduce((best, l) =>
    EFFORT_ORDER.indexOf(l) > EFFORT_ORDER.indexOf(best) ? l : best,
    pool[0],
  );
}

/** The trail as one line, for the error a caller actually reads. */
export function describeTrail(trail: Elimination[]): string {
  if (trail.length === 0) return 'no provider in the plan was reachable';
  return trail
    .map((t) => (t.kind === 'not-configured' ? `${t.provider}: ${t.kind}` : `${t.provider}: ${t.kind} (${t.detail})`))
    .join('; ');
}
