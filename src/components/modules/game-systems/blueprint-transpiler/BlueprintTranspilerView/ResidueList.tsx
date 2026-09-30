'use client';

import { CircleDashed, CornerDownRight, XCircle } from 'lucide-react';
import type { ResidueEntry, ResidueFile } from '@/lib/blueprint-transpiler/residue';
import { DecoratedJargon } from '@/components/ui/TermChip';

// ─── Transpile residue worklist ─────────────────────────────────────────────
//
// Every node that did not become code, by name and reason. A refused node is
// one click from the `// TODO` stub it left; a never-reached node left no stub
// and is listed so its logic is not silently lost.

function fileLabel(file: ResidueFile): string {
  return file === 'header' ? '.h' : '.cpp';
}

function Group({ title, hint, entries, onLocate }: {
  title: string;
  hint: string;
  entries: ResidueEntry[];
  onLocate: (file: ResidueFile, line: number) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-1">
      <h4 className="px-1 text-2xs font-semibold text-text">
        {title} <span className="font-normal text-text-muted">({entries.length}) · {hint}</span>
      </h4>
      <ul className="space-y-1">
        {entries.map((e, i) => {
          const icon = e.disposition === 'refused'
            ? <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-400" aria-hidden />
            : <CircleDashed className="w-3 h-3 flex-shrink-0 mt-0.5 text-text-muted" aria-hidden />;
          const body = (
            <>
              {icon}
              <span className="min-w-0 flex-1">
                <span className="font-mono text-text">{e.label}</span>
                {e.reason && <> — <DecoratedJargon text={e.reason} className="text-text-muted" /></>}
              </span>
            </>
          );
          const line = e.line;
          return (
            <li key={`${e.nodeId}#${i}`} data-node-id={e.nodeId}>
              {line !== null ? (
                <button
                  type="button"
                  onClick={() => onLocate(e.file, line)}
                  title={`Open ${fileLabel(e.file)} at line ${line}`}
                  className="w-full flex items-start gap-2 px-2 py-1 rounded bg-surface text-2xs text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
                >
                  {body}
                  <span className="flex items-center gap-0.5 flex-shrink-0 font-mono text-text-muted">
                    <CornerDownRight className="w-3 h-3" aria-hidden />
                    {fileLabel(e.file)}:{line}
                  </span>
                </button>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1 rounded bg-surface text-2xs">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ResidueList({ entries, onLocate }: {
  entries: ResidueEntry[];
  onLocate: (file: ResidueFile, line: number) => void;
}) {
  return (
    <div data-testid="transpile-residue" className="border-b border-border max-h-48 overflow-y-auto p-2 space-y-2">
      <Group
        title="Refused"
        hint="left as a // TODO stub — click to open it"
        entries={entries.filter((e) => e.disposition === 'refused')}
        onLocate={onLocate}
      />
      <Group
        title="Never reached"
        hint="not evaluated, so not counted as translated"
        entries={entries.filter((e) => e.disposition === 'unreached')}
        onLocate={onLocate}
      />
    </div>
  );
}
