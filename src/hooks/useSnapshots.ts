'use client';

/**
 * React hook for the PoF Bridge visual-regression loop: capture, read the diff,
 * accept a baseline.
 *
 * The plugin's capture is asynchronous: POST /pof/snapshot/capture answers an
 * ACK (`{ accepted, presetIds }`), and the DiffReport is served by GET
 * /pof/snapshot/diff. So `capture` reads the diff back until a report NEWER than
 * the one known before the capture covers every requested preset (the plugin's
 * own `generatedAt`, never the browser clock), bounded by
 * `UI_TIMEOUTS.pofSnapshotReadbackTimeout`. The readback interval runs through
 * `useSuspendableEffect`, so a hidden LRU pane stops polling and resumes on show.
 *
 * `acceptBaselines` re-baselines only presets the shown report did not pass
 * (`planAccept`), then verifies the accept with an immediate recapture + readback
 * instead of assuming it. Nothing here runs on mount: every bridge call is a
 * user's click. Pure decisions live in `@/lib/pof-bridge/snapshot-review`.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { ok, err, type Result } from '@/types/result';
import {
  isReadbackFresh, normalizeCaptureReply, planAccept, readDiffReport, unverifiedAccepts,
  type ReadbackTarget,
} from '@/lib/pof-bridge/snapshot-review';
import type { PofSnapshotCaptureRequest, PofSnapshotDiffReport } from '@/types/pof-bridge';

interface UseSnapshotsResult {
  /** Capture, then resolve the read-back DiffReport (null on failure; `error` says why). */
  capture: (req: PofSnapshotCaptureRequest) => Promise<PofSnapshotDiffReport | null>;
  /** Baseline POST -> recapture those presets -> readback; resolves the verified re-diff. */
  acceptBaselines: (presetIds: string[]) => Promise<PofSnapshotDiffReport | null>;
  diffReport: PofSnapshotDiffReport | null;
  isCapturing: boolean;
  error: string | null;
  refreshDiff: () => Promise<void>;
}

type Outcome = Result<PofSnapshotDiffReport, string>;

interface Readback extends ReadbackTarget {
  deadline: number;
  settle: (outcome: Outcome) => void;
}

const snapshotUrl = () => `/api/pof-bridge/snapshot?port=${usePofBridgeStore.getState().pofPort}`;

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function timeoutReason(target: ReadbackTarget): string {
  const seconds = Math.round(UI_TIMEOUTS.pofSnapshotReadbackTimeout / 1000);
  const since = target.since ? `the one from ${target.since}` : 'the capture';
  return `Snapshot capture timed out: no diff report newer than ${since} covered ${target.presetIds.join(', ')} within ${seconds}s`;
}

export function useSnapshots(): UseSnapshotsResult {
  const [diffReport, setDiffReport] = useState<PofSnapshotDiffReport | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readback, setReadback] = useState<Readback | null>(null);

  /** The latest report shown: the readback's "since" and the only source an accept may plan from. */
  const reportRef = useRef<PofSnapshotDiffReport | null>(null);
  const readbackRef = useRef<Readback | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      readbackRef.current?.settle(err('Snapshot readback abandoned: the panel unmounted'));
      readbackRef.current = null;
    };
  }, []);

  // ── Readback: one interval while a capture awaits its report (paused while hidden) ──

  useSuspendableEffect(() => {
    if (!readback) return;
    let stopped = false;
    let inFlight = false;
    const finish = (outcome: Outcome) => {
      stopped = true;
      clearInterval(id);
      if (readbackRef.current === readback) readbackRef.current = null;
      if (mountedRef.current) setReadback((current) => (current === readback ? null : current));
      readback.settle(outcome);
    };
    const id = setInterval(() => {
      if (stopped || inFlight) return;
      inFlight = true;
      void tryApiFetch<unknown>(snapshotUrl()).then((res) => {
        inFlight = false;
        if (stopped) return;
        const report = res.ok ? readDiffReport(res.data) : null;
        if (report && isReadbackFresh(report, readback)) finish(ok(report));
        else if (Date.now() >= readback.deadline) finish(err(timeoutReason(readback)));
      });
    }, UI_TIMEOUTS.pofSnapshotPoll);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [readback]);

  const awaitReadback = useCallback((target: ReadbackTarget) => new Promise<Outcome>((resolve) => {
    if (!mountedRef.current) {
      resolve(err('Snapshot readback abandoned: the panel unmounted'));
      return;
    }
    readbackRef.current?.settle(err('Snapshot readback superseded by a newer capture'));
    const next: Readback = { ...target, deadline: Date.now() + UI_TIMEOUTS.pofSnapshotReadbackTimeout, settle: resolve };
    readbackRef.current = next;
    setReadback(next);
  }), []);

  /** POST capture, then read the report for what the reply is (ack -> readback). */
  const captureAndRead = useCallback(async (req: PofSnapshotCaptureRequest): Promise<Outcome> => {
    let since = reportRef.current?.generatedAt ?? null;
    if (!reportRef.current) {
      // No report shown yet: learn the plugin's latest so a stale one is never taken for this capture's.
      const before = await tryApiFetch<unknown>(snapshotUrl());
      since = (before.ok ? readDiffReport(before.data)?.generatedAt : null) ?? null;
    }
    const posted = await tryApiFetch<unknown>(snapshotUrl(), postJson(req));
    if (!posted.ok) return err(posted.error);
    const reply = normalizeCaptureReply(posted.data);
    if (reply.kind === 'invalid') return err(`Snapshot capture: ${reply.reason}`);
    if (reply.kind === 'report') return ok(reply.report);
    return awaitReadback({ since, presetIds: req.presetIds });
  }, [awaitReadback]);

  /** Show a settled outcome and release the busy flag; returns the report or null. */
  const conclude = useCallback((outcome: Outcome): PofSnapshotDiffReport | null => {
    if (outcome.ok) reportRef.current = outcome.data;
    if (mountedRef.current) {
      if (outcome.ok) setDiffReport(outcome.data);
      else setError(outcome.error);
      setIsCapturing(false);
    }
    return outcome.ok ? outcome.data : null;
  }, []);

  // ── Capture snapshots ──────────────────────────────────────────────────────

  const capture = useCallback(async (req: PofSnapshotCaptureRequest) => {
    setIsCapturing(true);
    setError(null);
    return conclude(await captureAndRead(req));
  }, [captureAndRead, conclude]);

  // ── Accept baselines (verified by a fresh compare) ─────────────────────────

  const acceptBaselines = useCallback(async (presetIds: string[]) => {
    const seen = reportRef.current;
    if (!seen) {
      setError('No diff report to accept from - capture and read the diff first');
      return null;
    }
    const plan = planAccept(seen, presetIds);
    if (plan.length === 0) {
      setError('Nothing to accept: only presets the shown report did not pass can become a baseline');
      return null;
    }
    setIsCapturing(true);
    setError(null);

    const saved = await tryApiFetch<unknown>(snapshotUrl(), postJson({ action: 'baseline', presetIds: plan }));
    if (!saved.ok) return conclude(err(saved.error));

    const report = conclude(await captureAndRead({
      presetIds: plan, compareToBaseline: true, diffThreshold: seen.diffThreshold,
    }));
    const still = report ? unverifiedAccepts(report, plan) : [];
    if (still.length > 0 && mountedRef.current) {
      setError(`Baseline saved, but the re-compare still differs for: ${still.join(', ')}`);
    }
    return report;
  }, [captureAndRead, conclude]);

  // ── Refresh diff report ────────────────────────────────────────────────────

  const refreshDiff = useCallback(async () => {
    const result = await tryApiFetch<unknown>(snapshotUrl());
    if (!mountedRef.current) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const report = readDiffReport(result.data);
    if (!report) {
      setError('Snapshot diff: the plugin answered something that is not a diff report');
      return;
    }
    reportRef.current = report;
    setDiffReport(report);
    setError(null);
  }, []);

  return {
    capture,
    acceptBaselines,
    diffReport,
    isCapturing,
    error,
    refreshDiff,
  };
}
