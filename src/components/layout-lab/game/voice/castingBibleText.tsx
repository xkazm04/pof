'use client';

/**
 * The voice bible as structure, not a raw markdown dump: `parseBible` splits the excerpt into sections
 * (`## Rhythm (checkable)` → title "Rhythm", note "checkable") with their bullet items, and `Inline` renders an
 * item's inline markdown (**bold**, `code`, "quoted lines") as React nodes (no innerHTML). The three Casting
 * page looks lay these sections out differently; the parsing is shared.
 */
import type { ReactNode } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';

export interface BibleItem { text: string; depth: number }
export interface BibleSection { title: string; note: string | null; items: BibleItem[] }

export function parseBible(md: string | null): BibleSection[] {
  if (!md) return [];
  const out: BibleSection[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const h = /^##\s+([^(]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(raw);
    if (h) { out.push({ title: h[1].trim(), note: h[2]?.trim() || null, items: [] }); continue; }
    const cur = out[out.length - 1];
    if (!cur || !raw.trim()) continue;
    const li = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/.exec(raw);
    if (li) cur.items.push({ text: li[2].trim(), depth: li[1].length >= 2 ? 1 : 0 });
    else if (cur.items.length && raw.startsWith(' ')) cur.items[cur.items.length - 1].text += ` ${raw.trim()}`;
    else cur.items.push({ text: raw.trim(), depth: 0 });
  }
  return out;
}

/** "Wants: to be one person again" → ["Wants", "to be one person again"]; null when the item has no lead. */
export function splitLead(text: string): [string, string] | null {
  const m = /^([A-Z][\w ]{1,24}):\s+(.+)$/.exec(text);
  return m ? [m[1], m[2]] : null;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|"[^"]+")/g;

export function Inline({ t, text }: { t: LabTheme; text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={i} style={{ color: t.inkDeep }}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) parts.push(<code key={i} style={{ fontFamily: 'var(--lab-font-mono)', fontSize: '0.92em', padding: '0 4px', borderRadius: 3, background: t.accentBg, color: t.inkDeep }}>{tok.slice(1, -1)}</code>);
    else parts.push(<span key={i} style={{ fontStyle: 'italic', color: t.inkDeep }}>&ldquo;{tok.slice(1, -1)}&rdquo;</span>);
    last = i + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** A section's items as a tidy list: lead words ("Wants:") set in the mono label face, sub-items indented. */
export function BibleItems({ t, items }: { t: LabTheme; items: BibleItem[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
      {items.map((it, i) => {
        const lead = splitLead(it.text);
        return (
          <li key={i} style={{ fontSize: 'var(--lab-fs-sm)', lineHeight: 1.5, color: t.text, paddingLeft: it.depth ? 16 : 0, display: 'flex', gap: 8 }}>
            <span aria-hidden style={{ color: t.muted, flex: 'none' }}>{it.depth ? '–' : '•'}</span>
            <span>
              {lead && <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: t.muted, marginRight: 6 }}>{lead[0]}</span>}
              <Inline t={t} text={lead ? lead[1] : it.text} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
