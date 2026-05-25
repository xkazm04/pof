'use client';

interface GlossaryTermProps {
  term: string;
  definition: string;
  className?: string;
}

/**
 * Inline glossary primitive — wraps a piece of UE5/PoF jargon with a hoverable
 * tooltip that explains it in plain language. Used across the ECW shell to
 * make the app readable by designers + PMs, not just engineers.
 *
 * Implementation: native `title` attribute for desktop hover, `aria-label`
 * for screen readers (per WCAG 2.1 — `title` alone is not announced by every
 * AT). Dotted underline visual cue + cursor-help. No JS tooltip lib needed.
 *
 * Phase 11-DS infrastructure idea `143ff660` (glossary layer over UE5 jargon).
 * Backing dictionary lives in `src/lib/ecw/glossary.ts` (also Phase 11-DS).
 */
export function GlossaryTerm({ term, definition, className }: GlossaryTermProps) {
  return (
    <span
      role="note"
      title={definition}
      aria-label={`${term}: ${definition}`}
      className={`underline decoration-dotted decoration-text-muted/50 underline-offset-2 cursor-help ${className ?? ''}`}
    >
      {term}
    </span>
  );
}
