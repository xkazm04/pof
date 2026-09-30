'use client';

/**
 * The one-shot PROPOSAL half — analyze, propose, refine — split out of `orchestrator.ts`.
 *
 * Gap-first: `analyze` stops at the resting `analyzed` phase with the distribution on screen,
 * and no LLM run is spawned until the operator picks a target (`proposeFor`). Each phase owns
 * its failure: a failed step returns the store to the resting phase it came from (idle /
 * analyzed / proposing) and rethrows, so the panel shows the reason and nothing is left
 * stranded in an in-flight phase that `canStart()` refuses forever. `cancel` abandons the
 * in-flight request the same way: every request holds a ticket, and an answer (or error) that
 * arrives for an invalidated ticket is dropped — it rejects with `cancelled` and writes nothing.
 */
import { useOneShotJobStore, type OneShotProposal } from '@/stores/oneShotJobStore';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import type { GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';

export type PostJson = <T>(url: string, body: unknown) => Promise<T>;

export interface ProposalPhases {
  /** POST /analyze only; ends in phase `analyzed` with the distribution stored. */
  analyze(catalogId: string, userHint?: string): Promise<CatalogDistribution>;
  /** From `analyzed`: propose aimed at `target` (null = let the model pick). */
  proposeFor(target: GapTarget | null, userHint?: string): Promise<void>;
  refine(userInput: string, forceMore?: boolean): Promise<void>;
  /** Abandon the in-flight analyze/propose/refine and rest where it started; false = none in flight. */
  cancel(): boolean;
}

function mkJobId(): string {
  return `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** POST a JSON body and unwrap the `{ success, data }` envelope (throws on error). */
export function createPostJson(fetchImpl: typeof fetch): PostJson {
  return async <T>(url: string, body: unknown): Promise<T> => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const env = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !env.success) throw new Error(env.error ?? `HTTP ${res.status} for ${url}`);
    return env.data as T;
  };
}

const store = () => useOneShotJobStore.getState();

export function createProposalPhases(postJson: PostJson): ProposalPhases {
  let ticket = 0;
  /** Await `p` for the newest ticket; a superseded/cancelled one rejects and runs no `onFail`. */
  async function current<T>(p: Promise<T>, onFail: (e: unknown) => void): Promise<T> {
    const mine = ++ticket;
    let value: T;
    try {
      value = await p;
    } catch (e) {
      if (mine !== ticket) throw new Error('cancelled');
      onFail(e);
      throw e;
    }
    if (mine !== ticket) throw new Error('cancelled');
    return value;
  }

  return {
    async analyze(catalogId, userHint) {
      if (!store().canStart()) throw new Error('another one-shot is in flight — cancel it first');
      store().reset();
      store().setPhase('analyzing', { catalogId, jobId: mkJobId(), userHint });
      const distribution = await current(
        postJson<CatalogDistribution>('/api/one-shot/analyze', { catalogId, userHint }),
        (e) => store().setPhase('idle', { failureReason: e instanceof Error ? e.message : String(e) }),
      );
      store().setDistribution(distribution);
      store().setPhase('analyzed');
      return distribution;
    },

    async proposeFor(target, userHint) {
      const s = store();
      if (s.phase !== 'analyzed' || !s.distribution || !s.catalogId) {
        throw new Error('analyze a catalog before proposing');
      }
      if (target && target.catalogId !== s.catalogId) {
        throw new Error(`target is for '${target.catalogId}', not the analyzed '${s.catalogId}'`);
      }
      const hint = userHint ?? s.userHint;
      s.setTarget(target);
      s.setProposal(null);
      s.setPhase('proposing', { userHint: hint });
      const proposal = await current(
        postJson<OneShotProposal>('/api/one-shot/propose', {
          catalogId: s.catalogId,
          distribution: s.distribution,
          userHint: hint,
          ...(target ? { target } : {}),
        }),
        () => { store().setTarget(null); store().setPhase('analyzed'); },
      );
      store().setProposal(proposal);
    },

    async refine(userInput, forceMore = false) {
      const s = store();
      if (!['proposing', 'refining'].includes(s.phase)) throw new Error('not in a refinable phase');
      // The refine route re-renders the full design prompt, so it needs the distribution too.
      if (!s.distribution) throw new Error('no distribution to refine against — analyze again');
      if (!s.incRefinementTurn(forceMore)) {
        throw new Error('refinement turn cap reached — pass forceMore=true to continue');
      }
      s.setPhase('refining');
      const proposal = await current(
        postJson<OneShotProposal>('/api/one-shot/refine', {
          catalogId: s.catalogId,
          distribution: s.distribution,
          prior: s.proposal,
          userInput,
          ...(s.target ? { target: s.target } : {}),
        }),
        () => store().setPhase('proposing'),
      );
      store().setProposal(proposal);
      store().setPhase('proposing');
    },

    cancel() {
      const s = store();
      const reason = { failureReason: 'cancelled' };
      if (s.phase === 'analyzing') s.setPhase('idle', reason);
      else if (s.phase === 'refining') s.setPhase('proposing', reason); // the prior proposal stands
      else if (s.phase === 'proposing' || s.phase === 'awaitingRun') {
        s.setProposal(null);
        s.setTarget(null);
        s.setPhase(s.distribution ? 'analyzed' : 'idle', reason);
      } else return false;
      ticket++;
      return true;
    },
  };
}
