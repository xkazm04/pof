'use client';

import { useCallback, useState } from 'react';
import { UE_GOTCHAS } from '@/lib/knowledge/ue-gotchas';
import { logger } from '@/lib/logger';
import { seedFromGotcha } from './seed';
import { runExperimentJob } from './client';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

type Status = 'idle' | 'running' | 'done' | 'error';

const STARTER = "unreal.log('RESULT=' + unreal.SystemLibrary.get_engine_version())";

/**
 * UE Experiment Lab — type/seed a UE 5.8 concept (Python), run it headless on the
 * connected project, and see the captured output (screenshot + log markers + an
 * optional Gemini visual verdict). Closes the research loop's theory→output gap.
 */
export function ExperimentLab() {
  const [python, setPython] = useState(STARTER);
  const [capture, setCapture] = useState(true);
  const [verifyPrompt, setVerifyPrompt] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSeed = useCallback((id: string) => {
    const g = UE_GOTCHAS.find((x) => x.id === id);
    if (!g) return;
    const seeded = seedFromGotcha(g);
    setPython(seeded.python);
    setVerifyPrompt(seeded.verifyPrompt);
  }, []);

  const onRun = useCallback(async () => {
    setStatus('running'); setErrMsg(null); setResult(null); setJobId(null);
    try {
      const { jobId: id, result: r } = await runExperimentJob({
        python, capture,
        verify: verifyPrompt.trim() ? { prompt: verifyPrompt.trim() } : undefined,
      });
      setJobId(id); setResult(r); setStatus('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'experiment failed');
      setStatus('error');
      logger.error('experiment run failed', e);
    }
  }, [python, capture, verifyPrompt]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
      <header>
        <h1 className="text-lg font-semibold">UE Experiment Lab</h1>
        <p className="text-text-muted">Run a concept on the connected UE 5.8 project and see theory → output.</p>
      </header>

      <label className="block">
        <span className="text-xs text-text-muted">Seed from a research finding</span>
        <select
          className="mt-1 w-full rounded border border-border bg-surface p-2"
          defaultValue=""
          onChange={(e) => onSeed(e.target.value)}
          aria-label="Seed from a research finding"
        >
          <option value="" disabled>Pick a gotcha to seed the probe…</option>
          {UE_GOTCHAS.map((g) => <option key={g.id} value={g.id}>{g.summary}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-text-muted">Python (single-quotes only; `unreal` is imported)</span>
        <textarea
          className="mt-1 h-48 w-full rounded border border-border bg-surface p-2 font-mono text-xs"
          value={python}
          onChange={(e) => setPython(e.target.value)}
          aria-label="Experiment Python"
          spellCheck={false}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={capture} onChange={(e) => setCapture(e.target.checked)} />
          <span>Capture viewport</span>
        </label>
        <input
          className="flex-1 rounded border border-border bg-surface p-2"
          placeholder="Optional: Gemini verify prompt (e.g. 'reflections look correct?')"
          value={verifyPrompt}
          onChange={(e) => setVerifyPrompt(e.target.value)}
          aria-label="Verify prompt"
        />
        <button
          type="button"
          onClick={onRun}
          disabled={status === 'running'}
          className="rounded bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {status === 'running' ? 'Running on UE 5.8…' : 'Run on UE 5.8'}
        </button>
      </div>

      {status === 'running' && <p className="text-text-muted">Launching a headless UE 5.8 editor — this takes a minute or two…</p>}
      {status === 'error' && <p className="text-red-500">Error: {errMsg}</p>}

      {result && (
        <section className="space-y-3 rounded border border-border p-4">
          <div className="flex items-center gap-3">
            <span className={result.ok ? 'font-medium text-emerald-500' : 'font-medium text-red-500'}>
              {result.ok ? '✓ ran' : '✗ failed'}
            </span>
            <span className="text-text-muted">{Math.round(result.durationMs / 1000)}s</span>
            {result.verdict && (
              <span className={result.verdict.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}>
                visual: {result.verdict.status} — {result.verdict.detail}
              </span>
            )}
          </div>
          {result.error && <p className="font-mono text-xs text-red-500">{result.error}</p>}
          {result.screenshotPath && jobId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/experiment/screenshot/${jobId}`} alt="captured viewport" className="max-w-full rounded border border-border" />
          )}
          {Object.keys(result.markers).length > 0 && (
            <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs">
              {Object.entries(result.markers).map(([k, v]) => `${k}=${v}`).join('\n')}
            </pre>
          )}
          {result.logs.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-text-muted">log ({result.logs.length} lines)</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-surface p-2 font-mono text-2xs">{result.logs.join('\n')}</pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
