/**
 * The READER for the evidence a drained gate persists.
 *
 * `drainOne` merges a verdict's bounded {@link GateEvidence} into the artifact's `data.evidence`
 * so a flip can be audited without re-running the gate — but nothing ever read it back, which made
 * the field (and the claim on `GateVerdict.evidence`) write-only. This module is that reader: it
 * validates the stored shape and projects it into an auditable row, served by
 * `GET /api/pipeline-artifacts/drain/evidence` and surfaced headlessly as `pof_gate_evidence`,
 * so the judge fleet reads the PROOF behind a pass/fail instead of trusting the status word.
 *
 * Pure (no DB, no I/O) — the caller supplies the artifacts.
 */
import { summarizeEvidence, type GateEvidence, type GateEvidenceKind } from '@/types/observation';
import { isSyntheticEntity } from '@/lib/status/statusModel';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const KINDS: readonly GateEvidenceKind[] = ['scenario', 'automation', 'bridge', 'visual'];

/**
 * Read the persisted evidence off an artifact's `data`, or null when absent/malformed.
 * Defensive: `data` is free-form JSON written by many producers, so a row whose `evidence`
 * key holds something else must read as "no evidence", never as a half-parsed verdict proof.
 */
export function readEvidence(artifact: Pick<PipelineArtifact, 'data'>): GateEvidence | null {
  const raw = (artifact.data as Record<string, unknown> | undefined)?.evidence;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.kind !== 'string' || !KINDS.includes(e.kind as GateEvidenceKind)) return null;
  if (typeof e.at !== 'string' || !e.at) return null;
  return e as unknown as GateEvidence;
}

/** One audited gate verdict: the row's verdict PLUS the proof it was read from. */
export interface GateEvidenceRow {
  catalogId: string;
  entityId: string;
  step: string;
  status: string;
  tier?: string;
  /** The verdict detail persisted as the artifact reason. */
  reason?: string;
  /** One-line human summary (same projection the verdict-changed event carries). */
  summary?: string;
  evidence: GateEvidence;
}

export interface EvidenceAudit {
  rows: GateEvidenceRow[];
  /** Gate-tier rows carrying NO evidence — an un-auditable verdict is itself a finding. */
  missing: Array<{ catalogId: string; entityId: string; step: string; status: string; tier?: string }>;
}

export interface EvidenceAuditFilter {
  entityId?: string;
  step?: string;
  tier?: 'L3' | 'L4';
  /** Include synthetic fixture entities (excluded by default — they are not production truth). */
  includeSynthetic?: boolean;
}

const GATE_TIERS = new Set(['L3', 'L4']);

/**
 * Project artifacts into an evidence audit: every L3/L4 row split into those whose verdict
 * carries readable proof and those whose does not. Pure.
 */
export function buildEvidenceAudit(artifacts: PipelineArtifact[], filter: EvidenceAuditFilter = {}): EvidenceAudit {
  const rows: GateEvidenceRow[] = [];
  const missing: EvidenceAudit['missing'] = [];
  for (const a of artifacts) {
    if (!a.tier || !GATE_TIERS.has(a.tier)) continue;
    if (filter.tier && a.tier !== filter.tier) continue;
    if (filter.entityId && a.entityId !== filter.entityId) continue;
    if (filter.step && a.step !== filter.step) continue;
    if (!filter.includeSynthetic && isSyntheticEntity(a.entityId)) continue;
    const base = {
      catalogId: a.catalogId,
      entityId: a.entityId,
      step: a.step,
      status: a.status,
      ...(a.tier ? { tier: a.tier } : {}),
    };
    const evidence = readEvidence(a);
    if (!evidence) { missing.push(base); continue; }
    const summary = summarizeEvidence(evidence);
    rows.push({
      ...base,
      ...(a.reason ? { reason: a.reason } : {}),
      ...(summary ? { summary } : {}),
      evidence,
    });
  }
  return { rows, missing };
}
