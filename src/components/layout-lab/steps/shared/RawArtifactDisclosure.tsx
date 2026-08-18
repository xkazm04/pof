'use client';

import { useState } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '../../theme';

/**
 * Collapsed RAW-ARTIFACT disclosure — the honest window onto what a step actually stored.
 *
 * A step's Produce writes 10–60× more than any View renders or any Checker grades: a
 * `wiringContract`, notes, dependency lists, per-sector breakdowns. None of it was reachable
 * from the UI, so a produce body could be rich, empty, or wrong and the panel looked the
 * same. This renders EXACTLY what is persisted for the step — the produced `data`, the UE
 * asset paths, and (when the server has one) the persisted verdict — and invents nothing.
 *
 * Cheap by construction: the payload is only serialized when the disclosure is OPEN, so the
 * ~342 generic steps pay nothing for it while collapsed. `<details>` is kept CONTROLLED
 * (summary click toggles state) so the open/closed state is deterministic for tests and
 * keyboard activation (Enter/Space on `<summary>` fires the same click).
 */
export function RawArtifactDisclosure({ t, data, ueAssets, verdict }: {
  t: LabTheme;
  /** The step artifact's produced payload (`LabStepArtifact.data`). */
  data: Record<string, unknown>;
  ueAssets?: string[];
  /** The server-persisted verdict carried on the artifact, when hydrated. */
  verdict?: { status?: string; tier?: string; reason?: string };
}) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(data ?? {});
  const produced = keys.length > 0;

  // Only pay for serialization while expanded.
  //
  // Serialization MUST NOT throw. This panel is the payload window inside
  // `StepCrashBoundary`'s fallback card, so a throw here escalates out of the
  // fallback to the route boundary — a crash card that itself crashes, taking
  // down the shell the boundary exists to protect. An artifact reaches us from
  // SQLite, written by other sessions, the MCP submit path and headless drains,
  // so a circular structure or a BigInt is untrusted input, not a theoretical.
  // Report the failure verbatim instead: an unreadable payload is a finding, and
  // saying so beats both a blank panel and a second crash.
  let json = '';
  let serializeError: string | null = null;
  if (open) {
    try {
      json = JSON.stringify(
        {
          data,
          ...(ueAssets?.length ? { ueAssets } : {}),
          ...(verdict?.status ? { serverVerdict: verdict } : {}),
        },
        null,
        2,
      );
    } catch (err) {
      serializeError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      json = `This artifact could not be serialized for display.\n\n${serializeError}\n\nThe stored payload is intact — only this preview failed. Top-level keys: ${keys.length ? keys.join(', ') : '(none)'}`;
    }
  }

  return (
    <details data-testid="raw-artifact" open={open} style={{ display: 'grid', gap: 8 }}>
      <summary
        data-testid="raw-artifact-summary"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className={t.fontMono}
        style={{ cursor: 'pointer', color: t.muted, fontSize: 14, listStyle: 'revert' }}
      >
        Raw artifact — {produced ? `${keys.length} field${keys.length === 1 ? '' : 's'}` : 'nothing produced yet'}
      </summary>
      {open && (
        produced ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {/* MicroLabel is a de-emphasis primitive (subtle|muted only) — the warning
                is carried by the wording and by the message in the pre block below,
                not by widening a shared primitive for one caller. */}
            <MicroLabel mono uppercase tone="muted">
              {serializeError ? 'Payload could not be serialized — preview failed, stored data intact' : 'Exactly what is stored for this step'}
            </MicroLabel>
            <pre
              data-testid="raw-artifact-json"
              className={t.fontMono}
              style={{
                margin: 0, padding: 10, maxHeight: 320, overflow: 'auto',
                fontSize: 13, lineHeight: 1.5, color: t.text,
                border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0,
                whiteSpace: 'pre', tabSize: 2,
              }}
            >
              {json}
            </pre>
          </div>
        ) : (
          <span style={{ fontSize: 14, color: t.muted }}>
            This step has produced no artifact yet — run Produce and the stored payload appears here verbatim.
          </span>
        )
      )}
    </details>
  );
}
