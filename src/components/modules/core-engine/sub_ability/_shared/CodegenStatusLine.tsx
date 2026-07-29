'use client';

import { Loader2, PackageCheck, AlertTriangle } from 'lucide-react';
import { ACCENT_CYAN, STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { codegenSummary } from '@/lib/ability/codegen-report';
import type { CodegenStatus } from './useCodegenStatus';

/**
 * Honest one-line outcome for a `generate-gas-effects` run: dispatched while it
 * is in flight, then the agent-reported truth — files written / build / seeded
 * DT rows on success, the concrete reason on failure. Shared by the Forge adopt
 * bar and the Blueprint editor's spec bar.
 */
export function CodegenStatusLine({ status }: { status: CodegenStatus }) {
  if (status.state === 'idle') return null;

  if (status.state === 'dispatched') {
    return (
      <span className="flex items-center gap-1" style={{ color: ACCENT_CYAN }} data-codegen-state="dispatched">
        <Loader2 className="w-3 h-3 animate-spin" /> UE codegen dispatched — waiting for the agent&apos;s report…
      </span>
    );
  }

  if (status.state === 'confirmed' && status.report) {
    return (
      <span className="flex items-center gap-1" style={{ color: STATUS_SUCCESS }} data-codegen-state="confirmed">
        <PackageCheck className="w-3 h-3" /> C++ generated in UE — {codegenSummary(status.report)}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1" style={{ color: STATUS_ERROR }} data-codegen-state="failed">
      <AlertTriangle className="w-3 h-3" /> UE codegen not confirmed — {status.reason ?? 'no reason reported'}
    </span>
  );
}
