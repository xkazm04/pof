'use client';

import { useCallback, useState } from 'react';
import { UE_GOTCHAS } from '@/lib/knowledge/ue-gotchas';
import { logger } from '@/lib/logger';
import { seedFromGotcha } from './seed';
import { runExperimentJob } from './client';
import { buildAssertions, type AssertionToggles } from './assertions';
import { ExperimentHistory } from './ExperimentHistory';
import { VISUAL_CHECK_MODES, type ExperimentResult, type ExperimentSpec, type VisualCheckMode } from '@/lib/ue-experiment/runner';
import { StatusTag } from '@/components/ui/StatusTag';

type Status = 'idle' | 'running' | 'done' | 'error';
type Mode = 'python' | 'scenario';
const MODES: { key: Mode; label: string }[] = [
  { key: 'python', label: 'Editor Python' },
  { key: 'scenario', label: 'Gameplay Scenario' },
];
const ASSERT_KINDS: { key: keyof AssertionToggles; label: string }[] = [
  { key: 'moved', label: 'moved' },
  { key: 'animated', label: 'animated' },
  { key: 'montage', label: 'montage played' },
];

/** What each server-owned check actually looks for (route.ts:33-89) — named so the choice is
 *  informed rather than a bare mode word. */
const VERIFY_MODE_LABELS: Record<VisualCheckMode, string> = {
  character: 'Character — a humanoid renders, not missing / T-posed',
  hud: 'HUD — no UI element reads empty or zero-width',
  lighting: 'Lighting — the scene is lit, not black / un-lit',
  texture: 'Texture — seamless / tileable, no seam or baked lighting',
};

const STARTER = "unreal.log('RESULT=' + unreal.SystemLibrary.get_engine_version())";
// action+value injects the post-modifier vector straight into Enhanced Input — reliable,
// unlike Boolean-key injection (which has fidelity gaps). forward = [0, 1].
const STARTER_INPUTS = '[{ "action": "/Game/Input/Actions/IA_Move", "value": [0, 1], "start": 0.5, "duration": 2.5 }]';

/**
 * UE Experiment Lab — run a UE 5.8 concept and see the captured output. Two modes:
 * Editor Python (run a probe + screenshot) or Gameplay Scenario (drive the player
 * with inputs and observe behavioral metrics + the peak-action frame). Closes the
 * research loop's theory→output gap.
 */
export function ExperimentLab() {
  const [mode, setMode] = useState<Mode>('python');
  const [python, setPython] = useState(STARTER);
  const [capture, setCapture] = useState(true);
  const [scenarioMap, setScenarioMap] = useState('/Game/Maps/VerticalSlice');
  const [scenarioInputs, setScenarioInputs] = useState(STARTER_INPUTS);
  const [removeEnemies, setRemoveEnemies] = useState(true);
  const [verifyMode, setVerifyMode] = useState<VisualCheckMode | ''>('');
  const [allowRunningEditor, setAllowRunningEditor] = useState(false);
  const [asserts, setAsserts] = useState<AssertionToggles>({});
  const [status, setStatus] = useState<Status>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const onSeed = useCallback((id: string) => {
    const g = UE_GOTCHAS.find((x) => x.id === id);
    if (!g) return;
    setPython(seedFromGotcha(g).python);
  }, []);

  const onRun = useCallback(async () => {
    let spec: ExperimentSpec;
    if (mode === 'scenario') {
      try {
        const inputs = JSON.parse(scenarioInputs);
        const assert = buildAssertions(asserts);
        spec = {
          python: '',
          scenario: { map: scenarioMap, inputs, totalSeconds: 4, numSamples: 8, disableAI: removeEnemies, ...(assert.length ? { assert } : {}) },
          verify: verifyMode ? { mode: verifyMode } : undefined,
          allowRunningEditor,
        };
      } catch {
        setErrMsg('Inputs must be valid JSON (an array of { key/action, start, duration }).');
        setStatus('error');
        return;
      }
    } else {
      spec = { python, capture, verify: verifyMode ? { mode: verifyMode } : undefined, allowRunningEditor };
    }
    setStatus('running'); setErrMsg(null); setResult(null); setJobId(null);
    try {
      const { jobId: id, result: r } = await runExperimentJob(spec);
      setJobId(id); setResult(r); setStatus('done');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'experiment failed');
      setStatus('error');
      logger.error('experiment run failed', e);
    }
  }, [mode, python, capture, scenarioMap, scenarioInputs, removeEnemies, verifyMode, allowRunningEditor, asserts]);

  const s = result?.observationSummary;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
      <header>
        <h1 className="text-lg font-semibold">UE Experiment Lab</h1>
        <p className="text-text-muted">Run a concept on the connected UE 5.8 project and see theory → output.</p>
      </header>

      {/* Real tab semantics: each tab owns its panel (aria-controls/labelledby) and the
          group is one tab stop with ←/→ moving between modes, per the WAI-ARIA pattern. */}
      <div className="flex gap-2" role="tablist" aria-label="Experiment mode">
        {MODES.map(({ key, label }, i) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`experiment-tab-${key}`}
            aria-selected={mode === key}
            aria-controls={`experiment-panel-${key}`}
            tabIndex={mode === key ? 0 : -1}
            onClick={() => setMode(key)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const next = MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length];
              setMode(next.key);
              document.getElementById(`experiment-tab-${next.key}`)?.focus();
            }}
            className={`focus-ring rounded px-3 py-1 ${mode === key ? 'bg-emerald-600 text-white' : 'bg-surface text-text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'python' ? (
        <div className="space-y-4" role="tabpanel" id="experiment-panel-python" aria-labelledby="experiment-tab-python">
          <label className="block">
            <span className="text-xs text-text-muted">Seed from a research finding</span>
            <select className="mt-1 w-full rounded border border-border bg-surface p-2" defaultValue="" onChange={(e) => onSeed(e.target.value)} aria-label="Seed from a research finding">
              <option value="" disabled>Pick a gotcha to seed the probe…</option>
              {UE_GOTCHAS.map((g) => <option key={g.id} value={g.id}>{g.summary}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-text-muted">Python (single-quotes only; `unreal` is imported)</span>
            <textarea className="mt-1 h-48 w-full rounded border border-border bg-surface p-2 font-mono text-xs" value={python} onChange={(e) => setPython(e.target.value)} aria-label="Experiment Python" spellCheck={false} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={capture} onChange={(e) => setCapture(e.target.checked)} />
            <span>Capture viewport</span>
          </label>
        </div>
      ) : (
        <div className="space-y-4" role="tabpanel" id="experiment-panel-scenario" aria-labelledby="experiment-tab-scenario">
          <label className="block">
            <span className="text-xs text-text-muted">Map (a lit level the player spawns into)</span>
            <input className="mt-1 w-full rounded border border-border bg-surface p-2 font-mono text-xs" value={scenarioMap} onChange={(e) => setScenarioMap(e.target.value)} aria-label="Scenario map" />
          </label>
          <label className="block">
            <span className="text-xs text-text-muted">Inputs — JSON; prefer {`{ action, value:[x,y], start, duration }`} (reliable) over {`{ key }`}</span>
            <textarea className="mt-1 h-32 w-full rounded border border-border bg-surface p-2 font-mono text-xs" value={scenarioInputs} onChange={(e) => setScenarioInputs(e.target.value)} aria-label="Scenario inputs" spellCheck={false} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={removeEnemies} onChange={(e) => setRemoveEnemies(e.target.checked)} aria-label="Remove enemies" />
            <span>Remove enemies (isolate movement — uncheck to test combat)</span>
          </label>
          <div className="flex flex-wrap items-center gap-4" aria-label="behavioral assertions">
            <span className="text-xs text-text-muted">Assert behavior:</span>
            {ASSERT_KINDS.map((a) => (
              <label key={a.key} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={!!asserts[a.key]} onChange={(e) => setAsserts((p) => ({ ...p, [a.key]: e.target.checked }))} aria-label={`assert ${a.label}`} />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {/* The four checks the judge route actually implements. This replaced a free-text
            prompt box whose value the route never declared and always discarded — a control
            whose value is discarded is worse than no control. The rubric stays server-owned
            on purpose: a judge whose instructions the subject can edit is not a judge. */}
        <div className="min-w-64 flex-1">
          <label htmlFor="experiment-verify-mode" className="block text-xs text-text-muted">Visual check (optional)</label>
          <select
            id="experiment-verify-mode"
            aria-describedby="experiment-verify-hint"
            className="focus-ring mt-1 w-full rounded border border-border bg-surface p-2"
            value={verifyMode}
            onChange={(e) => setVerifyMode(e.target.value as VisualCheckMode | '')}
          >
            <option value="">Off — no visual check</option>
            {VISUAL_CHECK_MODES.map((m) => <option key={m} value={m}>{VERIFY_MODE_LABELS[m]}</option>)}
          </select>
          <p id="experiment-verify-hint" className="mt-1 text-2xs text-text-muted">
            Runs the server-owned vision check for the chosen mode on the captured frame. If the judge
            can&apos;t run (no key, an API error), the result is <em>deferred</em> with the reason — never a fail.
          </p>
        </div>
        <button type="button" onClick={onRun} disabled={status === 'running'} aria-busy={status === 'running'} className="focus-ring rounded bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50">
          {status === 'running' ? 'Running on UE 5.8…' : 'Run on UE 5.8'}
        </button>
      </div>

      {/* A run boots its OWN editor. PoF refuses when one is already live rather than killing
          it (that used to destroy unsaved work); this is the explicit override, and it states
          its consequence at the control — it never kills anything either way. */}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={allowRunningEditor}
          onChange={(e) => setAllowRunningEditor(e.target.checked)}
          aria-describedby="experiment-allow-editor-hint"
          aria-label="Run anyway with an editor already open"
        />
        <span>
          Run anyway if an editor is already open
          <span id="experiment-allow-editor-hint" className="block text-2xs text-text-muted">
            By default a live UnrealEditor blocks the run and PoF explains why — it will never kill an editor it
            did not start. Ticking this launches a second instance beside yours: it commonly fails to start or
            fights the first for project file locks. Your open editor is left untouched either way.
          </span>
        </span>
      </label>

      {/* Run outcome is announced, not just coloured — the run takes minutes, so a
          screen-reader user must hear it start, and an error must interrupt. */}
      <p role="status" aria-live="polite" className="text-text-muted empty:hidden">
        {status === 'running' ? 'Launching UE 5.8 — this takes a minute or two…' : ''}
      </p>
      {status === 'error' && <p role="alert" className="text-red-500">Error: {errMsg}</p>}

      {/* A precondition refusal is NOT a failed experiment — nothing ran and nothing was
          observed. It gets its own state so it can never read as an observed defect. */}
      {result?.refused && (
        <section role="alert" className="space-y-1 rounded border border-amber-500/60 bg-amber-500/5 p-4">
          <p className="font-medium text-amber-500">⚠ Refused — nothing ran</p>
          <p className="text-xs text-text-muted">{result.error}</p>
        </section>
      )}

      {result && !result.refused && (
        <section className="space-y-3 rounded border border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={result.ok ? 'font-medium text-emerald-500' : 'font-medium text-red-500'}>{result.ok ? '✓ ran' : '✗ failed'}</span>
            <span className="text-text-muted">{Math.round(result.durationMs / 1000)}s</span>
            {result.behavioralVerdict && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">behavior</span>
                <StatusTag level={result.behavioralVerdict.status === 'pass' ? 'ok' : 'bad'} word={result.behavioralVerdict.status} />
                <span className="text-text-muted">{result.behavioralVerdict.detail}</span>
              </span>
            )}
            {result.verdict && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">visual</span>
                <StatusTag level={VERDICT_LEVEL[result.verdict.status]} word={result.verdict.status} />
                <span className="text-text-muted">{result.verdict.detail}</span>
              </span>
            )}
          </div>
          {result.error && <p className="font-mono text-xs text-red-500">{result.error}</p>}
          {s && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="observation summary">
              <Stat label="samples" value={String(s.sampleCount)} />
              <Stat label="max speed" value={s.maxSpeed.toFixed(0)} />
              <Stat label="displacement" value={s.displacement.toFixed(0)} />
              <Stat label="montage" value={s.montagePlayed ? 'yes' : 'no'} />
            </div>
          )}
          {result.screenshotPath && jobId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/experiment/screenshot/${jobId}`} alt="captured frame" className="max-w-full rounded border border-border" />
          )}
          {Object.keys(result.markers).length > 0 && (
            <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs">{Object.entries(result.markers).map(([k, v]) => `${k}=${v}`).join('\n')}</pre>
          )}
          {result.logs.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-text-muted">log ({result.logs.length} lines)</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-surface p-2 font-mono text-2xs">{result.logs.join('\n')}</pre>
            </details>
          )}
        </section>
      )}

      <ExperimentHistory refreshKey={refreshKey} />
    </div>
  );
}

/** A judge that could not run is WARN (deferred), never the red an observed defect earns. */
const VERDICT_LEVEL = { pass: 'ok', fail: 'bad', deferred: 'warn' } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface p-2">
      <div className="text-2xs text-text-muted">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
