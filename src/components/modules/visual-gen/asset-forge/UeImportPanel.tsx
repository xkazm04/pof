'use client';

import { useEffect, useRef, useState } from 'react';
import { Boxes, Loader2 } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CollisionPlan, CollisionUse } from '@/lib/visual-gen/ue-import';
import type { CollisionPlanBasis } from '@/lib/visual-gen/ue-import-job-store';

/**
 * Send a finished mesh to UE — the forge-side face of `POST /api/visual-gen/ue-import`.
 *
 * The same shape as `ChaosClothPanel`, for the same reason: `importGlbToUE` was built,
 * tested and had NO caller, so nothing in the app ever put a generated mesh into the
 * project. The pipeline generated, finished and graded a `.glb` and then stopped at the
 * filesystem. This is the control that finishes it.
 *
 * Three things it refuses to blur:
 *  - **`use` is asked, never defaulted.** It is the one fact the mesh cannot supply and
 *    the one collision depends on: the same geometry wants hulls as a crate and nothing at
 *    all as a wall decoration. There is no pre-selected option.
 *  - **Requested collision and OBSERVED collision are rendered separately.** The card
 *    shows the plan, what the plan was based on, and the element count read back from
 *    `body_setup` — because "the collision call ran" is not evidence, and an asset with
 *    zero elements imports cleanly and then falls through the world.
 *  - **An assumed plan says so.** When the Tier-1 critic could not measure the mesh, the
 *    basis renders as a warning rather than being quietly folded into the plan.
 *
 * No live UE run happened in the session that built this; every state below is driven by
 * the route's own envelope.
 */

const FIELD =
  'w-full px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-text placeholder:text-text-muted focus-ring';

const USES: { id: CollisionUse; label: string; hint: string }[] = [
  { id: 'blocking', label: 'Blocking', hint: 'the player collides with it — hulls or a primitive' },
  { id: 'decorative', label: 'Decorative', hint: 'no collision at all; a bad hull is worse than none' },
  { id: 'character', label: 'Character', hint: 'collision built, never the render mesh' },
];

interface ImportStatus {
  status: 'running' | 'done' | 'error';
  glbPath: string;
  use: CollisionUse;
  assetPath?: string;
  collision: CollisionPlan | null;
  planBasis: CollisionPlanBasis | null;
  shells: number | null;
  collisionElements: number | null;
  critiqueUnavailable?: boolean;
  critiqueError?: string;
  error?: string;
}

/** The client's own patience, derived from the server's settle ceiling — never invented. */
const POLL_BUDGET_MS = 180_000 + UI_TIMEOUTS.experimentBudgetMargin;

export function UeImportPanel() {
  const [glbPath, setGlbPath] = useState('');
  const [assetName, setAssetName] = useState('');
  const [use, setUse] = useState<CollisionUse | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const poll = (jobId: string, deadline: number) => {
    timer.current = setTimeout(async () => {
      const res = await tryApiFetch<ImportStatus>(`/api/visual-gen/ue-import/status?jobId=${jobId}`);
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      setJob(res.data);
      if (res.data.status === 'running') {
        if (Date.now() >= deadline) {
          setBusy(false);
          setError('gave up polling — the editor is still running past the budget; the job may still finish');
          return;
        }
        poll(jobId, deadline);
        return;
      }
      setBusy(false);
    }, UI_TIMEOUTS.experimentPoll);
  };

  const submit = async () => {
    if (!use) return;
    setBusy(true);
    setJob(null);
    setError(null);
    const res = await tryApiFetch<{ jobId: string }>('/api/visual-gen/ue-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        glbPath: glbPath.trim(),
        use,
        ...(assetName.trim() ? { assetName: assetName.trim() } : {}),
      }),
    });
    if (!res.ok) { setError(res.error); setBusy(false); return; }
    poll(res.data.jobId, Date.now() + POLL_BUDGET_MS);
  };

  const ready = glbPath.trim() !== '' && use !== null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="ue-import-panel">
      <div className="flex items-center gap-2">
        <Boxes size={14} className="text-[var(--visual-gen)]" />
        <span className="text-xs font-medium text-text">Send to UE (static mesh + collision)</span>
      </div>

      <div className="rounded-md border border-border/70 p-2 text-2xs text-text-muted" data-testid="ue-import-prereqs">
        <p>
          This boots the editor (the glTF importer is unreliable in a commandlet), which takes minutes.
          Collision is built <span className="text-text">after</span> import and then read back from
          <span className="text-text"> body_setup</span> — an asset that reports zero elements is failed
          here rather than shipped, because it would import cleanly and fall through the world.
        </p>
        <p className="mt-1">
          The shell count driving the collision shape is MEASURED by the Tier-1 geometry gate. If that
          critic cannot run, the plan is marked assumed rather than presented as measured.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-2xs uppercase tracking-wide text-text-muted">Finished .glb on disk</span>
        <input
          className={FIELD}
          value={glbPath}
          onChange={(e) => setGlbPath(e.target.value)}
          placeholder="generated/mesh-finish/chair_lowpoly.glb"
          data-testid="ue-import-glb"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-2xs uppercase tracking-wide text-text-muted">Asset name (optional)</span>
        <input
          className={FIELD}
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
          placeholder="Chair"
          data-testid="ue-import-name"
        />
      </label>

      <div>
        <span className="mb-1 block text-2xs uppercase tracking-wide text-text-muted">
          What is it for? (decides collision — no default)
        </span>
        <div className="flex gap-2">
          {USES.map((u) => (
            <button
              key={u.id}
              onClick={() => setUse(u.id)}
              data-testid={`ue-import-use-${u.id}`}
              aria-pressed={use === u.id}
              title={u.hint}
              className={`flex-1 rounded-md border px-2 py-1 text-2xs transition-colors ${
                use === u.id
                  ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-2xs text-text-muted" data-testid="ue-import-use-hint">
          {use ? USES.find((u) => u.id === use)!.hint : 'Pick one — the mesh cannot tell us this.'}
        </p>
      </div>

      <button
        onClick={() => void submit()}
        disabled={busy || !ready}
        data-testid="ue-import-submit"
        className="w-full rounded-lg border border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 px-3 py-2 text-xs font-medium text-[var(--visual-gen)] transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : null}
        {busy ? 'Importing in the editor…' : 'Send to UE'}
      </button>

      {error && (
        <div className="space-y-1 rounded-md border border-border p-2" data-testid="ue-import-error" role="status">
          <StatusTag level="bad" word="ERROR" />
          <p className="text-2xs text-text-muted">{error}</p>
        </div>
      )}

      {job && (
        <div className="space-y-1.5 rounded-md border border-border p-2" data-testid="ue-import-result" role="status">
          <span data-testid="ue-import-verdict">
            <StatusTag
              level={job.status === 'done' ? 'ok' : job.status === 'error' ? 'bad' : 'warn'}
              word={job.status === 'done' ? 'IMPORTED' : job.status === 'error' ? 'FAILED' : 'RUNNING'}
            />
          </span>
          {job.error && <p className="text-2xs text-text-muted" data-testid="ue-import-reason">{job.error}</p>}
          {job.assetPath && (
            <p className="font-mono text-2xs text-text" data-testid="ue-import-asset-path">{job.assetPath}</p>
          )}

          {/* Requested — what the plan asked for, and on what evidence. */}
          {job.collision && (
            <div className="border-t border-border/60 pt-1.5" data-testid="ue-import-plan">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-text-muted">Collision requested</span>
                <span className="text-2xs text-text">{job.collision.kind}</span>
              </div>
              <p className="mt-0.5 text-2xs text-text-muted">{job.collision.reason}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-2xs text-text-muted">
                  Based on{job.shells !== null ? ` ${job.shells} shell(s)` : ''}
                </span>
                <StatusTag
                  level={job.planBasis === 'measured' || job.planBasis === 'not-needed' ? 'ok' : 'warn'}
                  word={(job.planBasis ?? 'unknown').toUpperCase()}
                  iconClassName="w-2.5 h-2.5"
                />
              </div>
              {job.critiqueUnavailable && (
                <p className="mt-0.5 text-2xs text-text-muted" data-testid="ue-import-critique-unavailable">
                  The geometry critic could not run{job.critiqueError ? ` — ${job.critiqueError}` : ''}. The mesh
                  was never inspected, so the shape below was assumed rather than measured.
                </p>
              )}
            </div>
          )}

          {/* Observed — the only thing that proves the asset actually blocks. */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-1.5">
            <span className="text-2xs text-text-muted">Collision OBSERVED on body_setup</span>
            {job.collisionElements === null ? (
              // A `none` plan asked for nothing, so nothing being counted is correct and is
              // NOT a status — only a requested-but-uncounted collision earns a red tag.
              job.collision && job.collision.kind !== 'none' ? (
                <StatusTag level="bad" word="NOT COUNTED" iconClassName="w-2.5 h-2.5" />
              ) : (
                <span className="text-2xs text-text-muted">none requested</span>
              )
            ) : (
              <StatusTag
                level={job.collisionElements > 0 ? 'ok' : 'bad'}
                word={`${job.collisionElements} ELEM`}
                iconClassName="w-2.5 h-2.5"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
