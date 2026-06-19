'use client';

import { useCallback, useState } from 'react';
import { UE_GOTCHAS } from '@/lib/knowledge/ue-gotchas';
import { logger } from '@/lib/logger';
import { seedFromGotcha } from './seed';
import { runExperimentJob } from './client';
import { buildAssertions, type AssertionToggles } from './assertions';
import { ExperimentHistory } from './ExperimentHistory';
import type { ExperimentResult, ExperimentSpec } from '@/lib/ue-experiment/runner';

type Status = 'idle' | 'running' | 'done' | 'error';
type Mode = 'python' | 'scenario';
const ASSERT_KINDS: { key: keyof AssertionToggles; label: string }[] = [
  { key: 'moved', label: 'moved' },
  { key: 'animated', label: 'animated' },
  { key: 'montage', label: 'montage played' },
];

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
  const [verifyPrompt, setVerifyPrompt] = useState('');
  const [asserts, setAsserts] = useState<AssertionToggles>({});
  const [status, setStatus] = useState<Status>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const onSeed = useCallback((id: string) => {
    const g = UE_GOTCHAS.find((x) => x.id === id);
    if (!g) return;
    const seeded = seedFromGotcha(g);
    setPython(seeded.python);
    setVerifyPrompt(seeded.verifyPrompt);
  }, []);

  const onRun = useCallback(async () => {
    let spec: ExperimentSpec;
    if (mode === 'scenario') {
      try {
        const inputs = JSON.parse(scenarioInputs);
        const assert = buildAssertions(asserts);
        spec = {
          python: '',
          scenario: { map: scenarioMap, inputs, totalSeconds: 4, numSamples: 8, ...(assert.length ? { assert } : {}) },
          verify: verifyPrompt.trim() ? { prompt: verifyPrompt.trim() } : undefined,
        };
      } catch {
        setErrMsg('Inputs must be valid JSON (an array of { key/action, start, duration }).');
        setStatus('error');
        return;
      }
    } else {
      spec = { python, capture, verify: verifyPrompt.trim() ? { prompt: verifyPrompt.trim() } : undefined };
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
  }, [mode, python, capture, scenarioMap, scenarioInputs, verifyPrompt, asserts]);

  const s = result?.observationSummary;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
      <header>
        <h1 className="text-lg font-semibold">UE Experiment Lab</h1>
        <p className="text-text-muted">Run a concept on the connected UE 5.8 project and see theory → output.</p>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Experiment mode">
        {(['python', 'scenario'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 ${mode === m ? 'bg-emerald-600 text-white' : 'bg-surface text-text-muted'}`}
          >
            {m === 'python' ? 'Editor Python' : 'Gameplay Scenario'}
          </button>
        ))}
      </div>

      {mode === 'python' ? (
        <>
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
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-xs text-text-muted">Map (a lit level the player spawns into)</span>
            <input className="mt-1 w-full rounded border border-border bg-surface p-2 font-mono text-xs" value={scenarioMap} onChange={(e) => setScenarioMap(e.target.value)} aria-label="Scenario map" />
          </label>
          <label className="block">
            <span className="text-xs text-text-muted">Inputs — JSON; prefer {`{ action, value:[x,y], start, duration }`} (reliable) over {`{ key }`}</span>
            <textarea className="mt-1 h-32 w-full rounded border border-border bg-surface p-2 font-mono text-xs" value={scenarioInputs} onChange={(e) => setScenarioInputs(e.target.value)} aria-label="Scenario inputs" spellCheck={false} />
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
        </>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <input className="flex-1 rounded border border-border bg-surface p-2" placeholder="Optional: Gemini verify prompt on the captured frame" value={verifyPrompt} onChange={(e) => setVerifyPrompt(e.target.value)} aria-label="Verify prompt" />
        <button type="button" onClick={onRun} disabled={status === 'running'} className="rounded bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50">
          {status === 'running' ? 'Running on UE 5.8…' : 'Run on UE 5.8'}
        </button>
      </div>

      {status === 'running' && <p className="text-text-muted">Launching UE 5.8 — this takes a minute or two…</p>}
      {status === 'error' && <p className="text-red-500">Error: {errMsg}</p>}

      {result && (
        <section className="space-y-3 rounded border border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={result.ok ? 'font-medium text-emerald-500' : 'font-medium text-red-500'}>{result.ok ? '✓ ran' : '✗ failed'}</span>
            <span className="text-text-muted">{Math.round(result.durationMs / 1000)}s</span>
            {result.behavioralVerdict && <span className={result.behavioralVerdict.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}>behavior: {result.behavioralVerdict.status} — {result.behavioralVerdict.detail}</span>}
            {result.verdict && <span className={result.verdict.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}>visual: {result.verdict.status} — {result.verdict.detail}</span>}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface p-2">
      <div className="text-2xs text-text-muted">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
