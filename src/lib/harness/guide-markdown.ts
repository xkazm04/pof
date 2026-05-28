/**
 * Lightweight Markdown parser tuned to the shape `renderGuideMarkdown` emits.
 *
 * The harness guide's vocabulary is deliberately small (h1/h2/h3 headings,
 * blockquotes, unordered + ordered lists, horizontal rules, fenced code,
 * paragraphs), so we hand-roll a single-pass tokenizer rather than pulling in
 * a full Markdown library. Phase headings (`### Phase N: <label>`) are
 * surfaced as their own block kind so the viewer's sticky rail + module-tinted
 * header can render them without re-parsing.
 */

export type GuideBlock =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | GuidePhaseBlock
  | { kind: 'paragraph'; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; lang: string | null; code: string; fileName?: string }
  | { kind: 'hr' };

export interface GuidePhaseBlock {
  kind: 'phase';
  /** 1-based phase number from `### Phase N: Label`. */
  phase: number;
  label: string;
  /** Optional duration chip pulled from a following `**Duration:** ...` line. */
  duration?: string;
}

const PHASE_HEADING_RE = /^###\s+Phase\s+(\d+):\s+(.+)$/;
const DURATION_RE = /^\*\*Duration:\*\*\s+(.+)$/;
const HR_RE = /^---+\s*$/;
const FENCE_RE = /^```([\w-]*)\s*$/;
const LIST_RE = /^([-*]|\d+\.)\s+(.+)$/;

/** Convert markdown text into a flat block stream tailored to the guide viewer. */
export function parseGuideMarkdown(md: string): GuideBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: GuideBlock[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(' ').trim();
    if (text) out.push({ kind: 'paragraph', text });
  };
  const flushList = (items: string[]) => {
    if (items.length) out.push({ kind: 'list', items });
  };
  const flushBlockquote = (lines: string[]) => {
    const text = lines.join(' ').trim();
    if (text) out.push({ kind: 'blockquote', text });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // ── Fenced code ────────────────────────────────────────────────────────
    const fence = trimmed.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] || null;
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().match(FENCE_RE)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      out.push({ kind: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────
    const phase = trimmed.match(PHASE_HEADING_RE);
    if (phase) {
      const block: GuidePhaseBlock = { kind: 'phase', phase: parseInt(phase[1], 10), label: phase[2].trim() };
      i++;
      // Pull a duration line if it appears in the next 5 non-empty lines.
      let lookAhead = i;
      let scanned = 0;
      while (lookAhead < lines.length && scanned < 6) {
        const t = lines[lookAhead].trim();
        const m = t.match(DURATION_RE);
        if (m) { block.duration = m[1].trim(); break; }
        if (t.startsWith('### ') || t.startsWith('## ') || t.startsWith('# ')) break;
        lookAhead++;
        if (t) scanned++;
      }
      out.push(block);
      continue;
    }
    if (trimmed.startsWith('# ')) { out.push({ kind: 'h1', text: trimmed.slice(2).trim() }); i++; continue; }
    if (trimmed.startsWith('## ')) { out.push({ kind: 'h2', text: trimmed.slice(3).trim() }); i++; continue; }
    if (trimmed.startsWith('### ')) { out.push({ kind: 'h3', text: trimmed.slice(4).trim() }); i++; continue; }

    // ── Horizontal rule ───────────────────────────────────────────────────
    if (HR_RE.test(trimmed)) { out.push({ kind: 'hr' }); i++; continue; }

    // ── Blockquote run ────────────────────────────────────────────────────
    if (trimmed.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      flushBlockquote(buf);
      continue;
    }

    // ── List run ──────────────────────────────────────────────────────────
    const listMatch = trimmed.match(LIST_RE);
    if (listMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(LIST_RE);
        if (!m) break;
        items.push(m[2].trim());
        i++;
      }
      flushList(items);
      continue;
    }

    // ── Paragraph run ─────────────────────────────────────────────────────
    const buf: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (t.startsWith('#') || t.startsWith('>') || HR_RE.test(t) || FENCE_RE.test(t) || LIST_RE.test(t)) break;
      buf.push(t);
      i++;
    }
    flushParagraph(buf);
  }

  return out;
}
