'use client';

import { cloneElement, isValidElement, useCallback, useEffect, useId, useState, type ReactElement } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { LicenseBadge } from './LicenseBadge';
import { AUDIO_PROVIDERS } from '@/lib/audio-gen/registry';
import { supportsKind, unsupportedKinds } from '@/lib/audio-gen/capabilities';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { AUDIO_KINDS, type AudioKind } from '@/lib/audio-gen/types';
import { planForgeRun, resolveForgeTarget, MAX_VARIATIONS_PER_RUN, type ForgePlan, type ForgeTarget } from '@/lib/audio-library/forgeTarget';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

/**
 * The Sound Forge offers exactly what the selected provider serves.
 *
 * Previously the picker hard-coded `sfx`/`ambient` while the provider advertised
 * `tts` and priced `music` — three lists that never agreed, and a route that
 * checked none of them. Now the picker is derived: every `AudioKind` is listed,
 * the ones outside `provider.capabilities` are disabled and their reasons are
 * printed underneath, and the route refuses them too (belt and braces).
 *
 * The Forge adds takes to a LIBRARY SET. It reads the library once on mount (the
 * free local GET, never the billed POST) and resolves the target with
 * `resolveForgeTarget`: a picked set, or a typed name the library already holds,
 * receives new, continued take numbers (`planForgeRun`) instead of cached repeats
 * or a same-named twin set. The Library's "More takes" hands a set id in through
 * `AudioView` (`initialTargetSetId`). Spend still happens only on the Generate
 * click, and the plan line states what that click will add before it is made.
 */
interface SoundForgePanelProps {
  /** A library set to add takes to (the Library's "More takes"). */
  initialTargetSetId?: string | null;
}

type LibraryState =
  | { status: 'loading' }
  | { status: 'ready'; sets: AudioSet[]; assets: AudioAsset[] }
  | { status: 'unavailable'; error: string };

const NO_SETS: AudioSet[] = [];
const NO_ASSETS: AudioAsset[] = [];

export function SoundForgePanel({ initialTargetSetId = null }: SoundForgePanelProps = {}) {
  const [providerId, setProviderId] = useState('elevenlabs');
  const [kind, setKind] = useState<AudioKind>('sfx');
  const [prompt, setPrompt] = useState('footstep on stone, short, dry, no reverb');
  const [duration, setDuration] = useState(1.5);
  const [variations, setVariations] = useState(3);
  const [setName, setSetName] = useState('footstep-stone');
  const [eventKey, setEventKey] = useState('footstep');
  const [surface, setSurface] = useState('stone');
  const [loop, setLoop] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(initialTargetSetId);
  const [library, setLibrary] = useState<LibraryState>({ status: 'loading' });
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState<Array<{ asset: AudioAsset; set: AudioSet; cached?: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  // The free local read of the library — never the billed POST.
  const loadLibrary = useCallback(async () => {
    const res = await tryApiFetch<{ sets?: unknown; assets?: unknown }>('/api/audio-gen');
    if (res.ok && Array.isArray(res.data.sets) && Array.isArray(res.data.assets)) {
      setLibrary({ status: 'ready', sets: res.data.sets as AudioSet[], assets: res.data.assets as AudioAsset[] });
    } else {
      const why = res.ok ? 'unexpected response' : res.error;
      logger.warn('sound-forge library read failed', { why });
      setLibrary({ status: 'unavailable', error: why });
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const provider = AUDIO_PROVIDERS[providerId];
  // Derived, never stored: switching to a provider that cannot serve the current
  // kind falls back to one it can, without a render-phase setState.
  const effectiveKind: AudioKind = provider && !supportsKind(provider, kind)
    ? (provider.capabilities[0] ?? kind)
    : kind;
  const unavailable = provider ? unsupportedKinds(provider) : [];

  const sets = library.status === 'ready' ? library.sets : NO_SETS;
  const assets = library.status === 'ready' ? library.assets : NO_ASSETS;
  const target = resolveForgeTarget(sets, assets, { typedName: setName, selectedSetId });
  const locked = target.mode === 'existing' ? target.set : null;
  const plan: ForgePlan | null = provider
    ? planForgeRun(target, { prompt, variations, kind: effectiveKind, eventKey, surface, loop, durationSeconds: duration }, provider)
    : null;
  const shownKind = locked ? locked.kind : effectiveKind;
  const license = provider?.commercialLicense[shownKind];

  async function handleGenerate() {
    if (!plan?.ok) return;
    setRunning(true);
    setError(null);
    setGenerated([]);
    // An existing set's bodies all carry its id; a new set's first body carries
    // only the name, and the id the route returns is threaded into the rest.
    let setId = plan.bodies[0]?.setId;
    try {
      for (const body of plan.bodies) {
        const res = await apiFetch<{ asset: AudioAsset; set: AudioSet; cached?: boolean }>('/api/audio-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, setId: body.setId ?? setId }),
        });
        setId = res.set.id;
        setGenerated((g) => [...g, res]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      logger.warn('sound-forge generate failed', { msg });
      setError(msg);
    } finally {
      setRunning(false);
      // The next plan must number past the takes this run added.
      void loadLibrary();
    }
  }

  const inputCls = 'w-full px-2 py-1.5 bg-surface-deep border border-border rounded text-xs text-text disabled:opacity-60';

  return (
    <div className="space-y-4 p-5 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold text-text">Sound Forge</h3>
        {license ? (
          <LicenseBadge license={license} kind={shownKind} />
        ) : (
          // No invented default: an undeclared licence is reported as undeclared,
          // never downgraded to a badge the provider never stated.
          <span className="text-2xs" style={{ color: STATUS_WARNING }} data-testid="forge-license-undeclared">
            Licence not declared for {shownKind}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
            {Object.values(AUDIO_PROVIDERS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Kind">
          <select value={shownKind} onChange={(e) => setKind(e.target.value as AudioKind)}
                  aria-label="Kind" disabled={!!locked} className={inputCls}>
            {AUDIO_KINDS.map((k) => {
              const served = provider ? supportsKind(provider, k) : false;
              return (
                <option key={k} value={k} disabled={!served}>
                  {served ? k : `${k} — not available`}
                </option>
              );
            })}
          </select>
        </Field>
      </div>

      {/* An unavailable kind is shown, disabled, WITH the provider's reason —
          the route refuses it too, so the picker and the server agree. */}
      {unavailable.length > 0 && (
        <ul className="space-y-1 text-2xs text-text-muted" data-testid="forge-unsupported-kinds">
          {unavailable.map(({ kind: k, reason }) => (
            <li key={k}>
              <span className="font-semibold" style={{ color: STATUS_WARNING }}>{k} unavailable</span>
              {' — '}{reason}
            </li>
          ))}
        </ul>
      )}

      <Field label="Prompt">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                  className="w-full px-3 py-2 bg-surface-deep border border-border rounded text-xs text-text" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Duration (s, 0=auto)">
          <input type="number" step={0.5} min={0} max={22} value={duration}
                 onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Variations">
          <input type="number" min={1} max={MAX_VARIATIONS_PER_RUN} value={variations} aria-label="Variations"
                 onChange={(e) => setVariations(Math.max(1, Math.min(MAX_VARIATIONS_PER_RUN, Number(e.target.value))))}
                 className={inputCls} />
        </Field>
        <Field label="Loopable (ambient)">
          <label className="flex items-center gap-2 text-xs text-text-muted-hover py-1.5">
            <input type="checkbox" checked={locked ? locked.loopable : loop}
                   disabled={!!locked || effectiveKind !== 'ambient'} onChange={(e) => setLoop(e.target.checked)} /> loop
          </label>
        </Field>
      </div>

      <Field label="Target set">
        <select value={selectedSetId && sets.some((s) => s.id === selectedSetId) ? selectedSetId : ''} onChange={(e) => setSelectedSetId(e.target.value || null)}
                aria-label="Target set" data-testid="forge-target" disabled={library.status !== 'ready'} className={inputCls}>
          <option value="">New set (or a library name typed below)</option>
          {sets.map((s) => {
            const n = assets.filter((a) => a.setId === s.id).length;
            return <option key={s.id} value={s.id}>{`${s.name} · ${s.kind} · ${n} take${n === 1 ? '' : 's'}`}</option>;
          })}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Set name">
          <input value={target.mode === 'existing' && target.matchedBy === 'selection' ? target.set.name : setName}
                 disabled={target.mode === 'existing' && target.matchedBy === 'selection'}
                 onChange={(e) => setSetName(e.target.value)} aria-label="Set name" className={inputCls} />
        </Field>
        <Field label="Event key">
          <input value={locked ? locked.eventKey ?? '' : eventKey} disabled={!!locked} onChange={(e) => setEventKey(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Surface">
          <input value={locked ? locked.surface ?? '' : surface} disabled={!!locked} onChange={(e) => setSurface(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <PlanLine library={library} target={target} plan={plan}
                missingSetId={selectedSetId && library.status === 'ready' && !sets.some((s) => s.id === selectedSetId) ? selectedSetId : null} />

      <button onClick={handleGenerate} disabled={running || !plan?.ok || library.status === 'loading'}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ backgroundColor: `${MODULE_COLORS.content}15`, color: MODULE_COLORS.content, border: `1px solid ${MODULE_COLORS.content}30` }}>
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
        {running
          ? `Generating ${generated.length + 1}/${plan?.ok ? plan.bodies.length : variations}…`
          : `Generate ${variations} variation(s)`}
      </button>

      {error && <div className="text-2xs text-red-400">{error}</div>}

      {generated.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-2xs text-text-muted">
            Generated into set &quot;{generated[0]?.set.name}&quot; ({generated[0]?.set.id.slice(0, 8)})
            {generated.some((g) => g.cached) && (
              <span className="ml-1" style={{ color: STATUS_SUCCESS }}>
                · {generated.filter((g) => g.cached).length} served from cache (no spend)
              </span>
            )}
          </p>
          {generated.map(({ asset, cached }) => (
            <div key={asset.id} className="flex items-center gap-3 p-2 rounded bg-surface-deep border border-border">
              <span className="text-2xs text-text-muted truncate">{asset.filename}</span>
              {cached && (
                <span className="text-2xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${STATUS_SUCCESS}22`, color: STATUS_SUCCESS }}>
                  cached
                </span>
              )}
              <audio controls src={`/api/audio-asset?relPath=${encodeURIComponent(asset.relPath)}`} className="ml-auto h-7" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** What the Generate click will do, stated before it is made. */
function PlanLine({ library, target, plan, missingSetId }: {
  library: LibraryState; target: ForgeTarget; plan: ForgePlan | null; missingSetId: string | null;
}) {
  // No plan is stated until the library is read: before that a taken name looks free.
  if (library.status === 'loading') return <p className="text-2xs text-text-muted">Reading the library…</p>;
  return (
    <div className="space-y-1 text-2xs">
      {missingSetId && (
        <p data-testid="forge-target-missing" style={{ color: STATUS_WARNING }}>
          The picked set ({missingSetId.slice(0, 8)}) is no longer in the library; the target falls back to the set name below.
        </p>
      )}
      {library.status === 'unavailable' && (
        <p data-testid="forge-library-unavailable" style={{ color: STATUS_WARNING }}>
          Library unavailable ({library.error}): a name the library already holds cannot be detected, so this run may
          create a second set of that name.
        </p>
      )}
      {plan && !plan.ok && (
        <p data-testid="forge-plan-refusal" style={{ color: STATUS_WARNING }}>Nothing will be generated: {plan.detail}</p>
      )}
      {plan?.ok && (
        <p data-testid="forge-plan" className="text-text-muted">
          {plan.bodies.length} new take{plan.bodies.length === 1 ? '' : 's'}:{' '}
          {plan.firstTake === plan.lastTake ? `take ${plan.firstTake}` : `takes ${plan.firstTake}-${plan.lastTake}`}
          {' into '}<span className="text-text">{plan.setName}</span>
          {target.mode === 'new' && ' (a new set)'}
          {target.mode === 'existing' && target.matchedBy === 'name' && ' (this name is already in the library, so the takes join that set)'}
          {target.mode === 'existing' && plan.lockedFields.length > 0 && (
            <> · kind, event key, surface and loop come from the set</>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * The label text here used to be decorative — no `htmlFor`, no `id` on the
 * control — so a screen reader announced "combobox"/"edit text" with no name
 * unless the call site separately patched an `aria-label` on (only some of)
 * them (Kind, Variations, Target set, Set name). Provider, Duration, Event
 * key, Surface and Prompt never got that patch. Associating the label here,
 * once, fixes every Field instead of the next one needing its own patch.
 */
function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-2xs uppercase tracking-wider text-text-muted mb-1 font-semibold">{label}</label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}
