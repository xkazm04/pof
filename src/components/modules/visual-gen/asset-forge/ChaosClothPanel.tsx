'use client';

import { useState } from 'react';
import { Loader2, Shirt } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import { CHAOS_CLOTH_NOT_RUN, CHAOS_CLOTH_PLUGINS, type ClothResult } from '@/lib/visual-gen/chaos-cloth-contract';

/**
 * Chaos Cloth attach — the forge-side face of `POST /api/visual-gen/chaos-cloth`.
 *
 * The capability (`attachClothToCharacter`) has been proven headless since 2026-07-22 and
 * had NO caller: no route, no control. This panel is the control, and it sits beside the
 * mesh queue because a garment is only ever attached to a mesh that queue produced.
 *
 * Three things it refuses to blur:
 *  - **Prerequisites are disclosed BEFORE the click** (`CHAOS_CLOTH_PLUGINS` + the
 *    headless-editor precondition), never behind a disabled button: the plugin state and
 *    the process probe both live on the server, and an operator must always be able to
 *    try. This mirrors `MatrixBatchDrain`'s executor note.
 *  - **A not-run is not a failure.** A 503 naming {@link CHAOS_CLOTH_NOT_RUN} means the
 *    machine had no editor to boot (or one was already running / the gate drain held the
 *    lease) — the garment was never judged. It renders WARN with the runner's own reason,
 *    not the red a real unbound transfer earns.
 *  - **A run that finished unbound is a FAILURE with its reason**, not a green card: the
 *    skin-weight transfer is what makes the cape a cape.
 *
 * No live UE run happened in the session that built this; every state below is driven by
 * the route's own envelope.
 */

type GarmentSource = 'game' | 'glb';

const FIELD =
  'w-full px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-text placeholder:text-text-muted focus-ring';

/** What came back from one attach attempt — a graded run, or a run that never happened. */
type Attempt =
  | { kind: 'ran'; result: ClothResult }
  | { kind: 'not-run'; reason: string }
  | { kind: 'error'; reason: string };

function Field({ label, value, onChange, placeholder, testId }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; testId: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs uppercase tracking-wide text-text-muted">{label}</span>
      <input
        className={FIELD}
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** One row of the attach's observed sub-steps — the graph facts the runner actually reported. */
function StepRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-2xs text-text-muted">{label}</span>
      <StatusTag level={done ? 'ok' : 'bad'} word={done ? 'YES' : 'NO'} iconClassName="w-2.5 h-2.5" />
    </div>
  );
}

export function ChaosClothPanel() {
  const [skeletalMesh, setSkeletalMesh] = useState('');
  const [physicsAsset, setPhysicsAsset] = useState('');
  const [source, setSource] = useState<GarmentSource>('game');
  const [garment, setGarment] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const ready = skeletalMesh.trim() !== '' && physicsAsset.trim() !== '' && garment.trim() !== '';

  const submit = async () => {
    setBusy(true);
    setAttempt(null);
    const res = await tryApiFetch<ClothResult>('/api/visual-gen/chaos-cloth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetSkeletalMesh: skeletalMesh.trim(),
        physicsAsset: physicsAsset.trim(),
        ...(source === 'game' ? { garmentMeshPath: garment.trim() } : { garmentGlbPath: garment.trim() }),
      }),
    });
    setBusy(false);
    if (res.ok) { setAttempt({ kind: 'ran', result: res.data }); return; }
    // The route's 503 carries the not-run phrase; anything else is a real error.
    setAttempt(
      res.error.includes(CHAOS_CLOTH_NOT_RUN)
        ? { kind: 'not-run', reason: res.error }
        : { kind: 'error', reason: res.error },
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="chaos-cloth-panel">
      <div className="flex items-center gap-2">
        <Shirt size={14} className="text-[var(--visual-gen)]" />
        <span className="text-xs font-medium text-text">Attach cloth (Chaos Cloth, headless UE 5.8)</span>
      </div>

      {/* Prerequisites, in the open, before the click — never a disabled button. */}
      <div className="rounded-md border border-border/70 p-2 text-2xs text-text-muted" data-testid="chaos-cloth-prereqs">
        <p>
          This boots a headless editor and enables{' '}
          <span className="text-text">{CHAOS_CLOTH_PLUGINS.join(', ')}</span> for the run (they are not
          enabled in PoF.uproject). It refuses while an editor is open or the gate drain holds the editor
          lease — PoF never kills an editor it did not start.
        </p>
        <p className="mt-1">
          The garment must be FITTED to the target skeleton: the auto skin-weight transfer is the whole
          MVP, and an unfitted mesh comes back unbound.
        </p>
      </div>

      <Field label="Character skeletal mesh" value={skeletalMesh} onChange={setSkeletalMesh}
        placeholder="/Game/Characters/Manny/SKM_Manny" testId="cloth-skeletal-mesh" />
      <Field label="Character physics asset (cloth collider)" value={physicsAsset} onChange={setPhysicsAsset}
        placeholder="/Game/Characters/Manny/PHYS_Manny" testId="cloth-physics-asset" />

      <div className="flex gap-2">
        {(['game', 'glb'] as GarmentSource[]).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            data-testid={`cloth-source-${s}`}
            aria-pressed={source === s}
            className={`flex-1 rounded-md border px-2 py-1 text-2xs transition-colors ${
              source === s
                ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {s === 'game' ? 'Garment in /Game' : 'Garment .glb on disk'}
          </button>
        ))}
      </div>
      <Field
        label={source === 'game' ? 'Garment static mesh' : 'Garment .glb (imported first)'}
        value={garment}
        onChange={setGarment}
        placeholder={source === 'game' ? '/Game/Generated/Cloth/Cape' : 'generated/mesh-finish/cape_lowpoly.glb'}
        testId="cloth-garment"
      />

      <button
        onClick={() => void submit()}
        disabled={busy || !ready}
        data-testid="chaos-cloth-submit"
        className="w-full rounded-lg border border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 px-3 py-2 text-xs font-medium text-[var(--visual-gen)] transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : null}
        {busy ? 'Attaching cloth in the editor…' : 'Attach cloth'}
      </button>

      {attempt?.kind === 'not-run' && (
        <div className="space-y-1 rounded-md border border-border p-2" data-testid="chaos-cloth-notrun" role="status">
          <StatusTag level="warn" word="NOT RUN" />
          <p className="text-2xs text-text-muted">{attempt.reason}</p>
          <p className="text-2xs text-text-muted">
            Nothing was observed, so nothing was judged — this says no editor ran, not that the garment failed.
          </p>
        </div>
      )}

      {attempt?.kind === 'error' && (
        <div className="space-y-1 rounded-md border border-border p-2" data-testid="chaos-cloth-error" role="status">
          <StatusTag level="bad" word="ERROR" />
          <p className="text-2xs text-text-muted">{attempt.reason}</p>
        </div>
      )}

      {attempt?.kind === 'ran' && (
        <div className="space-y-1.5 rounded-md border border-border p-2" data-testid="chaos-cloth-result" role="status">
          <span data-testid="chaos-cloth-verdict">
            <StatusTag level={attempt.result.ok ? 'ok' : 'bad'} word={attempt.result.ok ? 'ATTACHED' : 'FAILED'} />
          </span>
          {attempt.result.error && (
            <p className="text-2xs text-text-muted" data-testid="chaos-cloth-reason">{attempt.result.error}</p>
          )}
          <StepRow label={`Dataflow nodes (${attempt.result.nodesAdded}/4)`} done={attempt.result.nodesAdded >= 4} />
          <StepRow label="Graph connected" done={attempt.result.connected} />
          <StepRow label="ClothAsset regenerated" done={attempt.result.regenerated} />
          <StepRow label="Skin-weight transfer bound" done={attempt.result.bound} />
          {attempt.result.clothAssetPath && (
            <p className="font-mono text-2xs text-text" data-testid="chaos-cloth-asset-path">
              {attempt.result.clothAssetPath}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
