'use client';

import { useId, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_WARNING,
  OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { ExplainerNarrative, ExplainerSection } from '@/lib/animations/state-machine-explainer';

interface ExplainPanelProps {
  narrative: ExplainerNarrative;
  accent?: string;
  title?: string;
}

/**
 * Renders an ExplainerNarrative as a plain-English breakdown.
 * Supports light markdown (`**bold**`, `` `code` ``) inline; intentionally
 * minimal so the source explainer data stays readable in tests.
 *
 * This is a *reading* surface, so all prose sits at the 12px legibility floor
 * (`TEXT_SCALE.body`) — `text-2xs` stays reserved for the dense section labels.
 * The panel is a labelled `<section>` so its `<h4>` section headings have a
 * heading parent instead of being orphaned under a plain `<span>`.
 */
export function ExplainPanel({
  narrative,
  accent = ACCENT_VIOLET,
  title = 'Plain-language explanation',
}: ExplainPanelProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border p-4 space-y-3"
      style={{
        backgroundColor: `${accent}${OPACITY_10}`,
        borderColor: `${accent}${OPACITY_30}`,
      }}
    >
      <div className="flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" style={{ color: accent }} />
        <h3 id={titleId} className={`${TEXT_SCALE.body} font-bold`} style={{ color: accent }}>
          {title}
        </h3>
      </div>

      <p className={`${TEXT_SCALE.body} text-text leading-relaxed`}>
        <InlineMarkdown text={narrative.summary} />
      </p>

      {narrative.sections.map((section, i) => (
        <ExplainSection key={i} section={section} accent={accent} />
      ))}
    </section>
  );
}

function ExplainSection({ section, accent }: { section: ExplainerSection; accent: string }) {
  const isWarning = section.heading.toLowerCase().includes('warning');
  const headingColor = isWarning ? STATUS_WARNING : accent;

  return (
    <div className="space-y-1.5">
      <h4
        className={`${TEXT_SCALE.meta} font-bold uppercase tracking-wider`}
        style={{ color: headingColor }}
      >
        {section.heading}
      </h4>
      {section.paragraphs.map((p, i) => (
        <p key={i} className={`${TEXT_SCALE.body} text-text-muted leading-relaxed`}>
          <InlineMarkdown text={p} />
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="space-y-1 pl-4">
          {section.bullets.map((b, i) => (
            <li
              key={i}
              className={`${TEXT_SCALE.body} text-text leading-relaxed list-disc marker:text-text-muted`}
            >
              <InlineMarkdown text={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Tiny inline-markdown renderer: `**bold**` and `` `code` ``.
 * Avoids pulling in a full markdown lib for this lightweight surface.
 */
function InlineMarkdown({ text }: { text: string }) {
  const parts = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'bold') return <strong key={i} className="text-text font-semibold">{p.value}</strong>;
        if (p.type === 'code') {
          return (
            <code
              key={i}
              // No size class: inline code inherits the surrounding prose size so it
              // stays at the 12px floor (a fixed sub-floor literal fails WCAG 1.4.4).
              className="px-1 py-0.5 rounded font-mono"
              style={{
                backgroundColor: `${ACCENT_CYAN}${OPACITY_10}`,
                color: ACCENT_CYAN,
                border: `1px solid ${ACCENT_CYAN}${OPACITY_20}`,
              }}
            >
              {p.value}
            </code>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}

type InlinePart = { type: 'text' | 'bold' | 'code'; value: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Single regex matches **...** or `...` in priority order, falling through to plain text.
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) parts.push({ type: 'bold', value: match[1] });
    else if (match[2] !== undefined) parts.push({ type: 'code', value: match[2] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return parts;
}
