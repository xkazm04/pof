# GDD Pitch Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Export Pitch" that turns the synthesized GDD into a polished, self-contained single-page HTML stakeholder pitch (print-friendly → PDF), beside the existing Export .md.

**Architecture:** A new pure module `gdd-pitch.ts` renders the HTML from a `GDDDocument`; the API route, hook, and view wire it in mirroring the existing markdown export path. Diagrams render via mermaid CDN with a readable source fallback.

**Tech Stack:** Next.js 16 route handlers, React 19, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-28-gdd-pitch-export-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/gdd-pitch.ts` | **new** — `exportGDDAsPitchHTML(gdd)` + private `mdToHtml` + escaping |
| `src/app/api/game-design-doc/route.ts` | **modify** — add `export-pitch` POST action |
| `src/hooks/useGameDesignDoc.ts` | **modify** — add `exportPitch()` |
| `src/components/modules/evaluator/GameDesignDocView.tsx` | **modify** — Export Pitch button + download |
| `src/__tests__/lib/gdd-pitch.test.ts` | **new** — pure HTML-generation tests |

---

## Task 1: Pure pitch-HTML generator

**Files:**
- Create: `src/lib/gdd-pitch.ts`
- Test: `src/__tests__/lib/gdd-pitch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/gdd-pitch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { exportGDDAsPitchHTML } from '@/lib/gdd-pitch';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

const fixture: GDDDocument = {
  title: 'Pillars of Fortune — Game Design Document',
  generatedAt: '2026-05-28T10:00:00.000Z',
  sections: [
    {
      id: 'overview', title: 'Project Overview', updatedAt: '2026-05-28T10:00:00.000Z',
      content: [
        '| Metric | Progress |',
        '|--------|----------|',
        '| Feature Implementation | 3/10 (30%) |',
      ].join('\n'),
      mermaid: 'pie title Feature Implementation Status\n    "Implemented" : 3\n    "Remaining" : 7',
    },
    {
      id: 'notes', title: 'Notes', updatedAt: '2026-05-28T10:00:00.000Z',
      content: 'Beware <script>alert(1)</script> in **content**.',
    },
  ],
  stats: {
    totalFeatures: 10, implementedFeatures: 3,
    checklistTotal: 20, checklistDone: 5,
    levelCount: 2, audioSceneCount: 4, buildCount: 6, evalFindingCount: 1,
  },
};

describe('exportGDDAsPitchHTML', () => {
  const html = exportGDDAsPitchHTML(fixture);

  it('returns a full self-contained HTML document with the title', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('Pillars of Fortune — Game Design Document');
    expect(html).toContain('<style>'); // inline CSS, no external stylesheet
  });

  it('renders the hero stats from gdd.stats', () => {
    expect(html).toContain('3/10');   // feature implementation
    expect(html).toContain('5/20');   // checklist
    expect(html).toContain('<div class="stat-value">2</div><div class="stat-label">Levels</div>'); // levelCount
  });

  it('converts a markdown table in section content to an HTML table', () => {
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Feature Implementation');
  });

  it('emits a .mermaid div carrying the diagram source', () => {
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('pie title Feature Implementation Status');
  });

  it('includes the mermaid CDN script', () => {
    expect(html).toMatch(/mermaid@11/);
    expect(html).toContain('<script type="module">');
  });

  it('HTML-escapes section content (no raw injected tags)', () => {
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/gdd-pitch.test.ts`
Expected: FAIL — "Failed to resolve import @/lib/gdd-pitch".

- [ ] **Step 3: Write the implementation**

Create `src/lib/gdd-pitch.ts`:

```ts
import type { GDDDocument, GDDSection } from './gdd-synthesizer';

/** HTML-escape text so GDD content can never inject markup. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Inline **bold** / *italic* on already-escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Minimal markdown → HTML (tables, headings, lists, bold/italic, paragraphs). Pure. */
function mdToHtml(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Table: header row followed by a |---| separator
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.includes('---')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(lines[i]); i++; }
      const cells = (r: string) => r.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push('<table><thead><tr>' + head.map((h) => `<th>${inline(esc(h))}</th>`).join('') + '</tr></thead><tbody>');
      for (const r of body) out.push('<tr>' + r.map((c) => `<td>${inline(esc(c))}</td>`).join('') + '</tr>');
      out.push('</tbody></table>');
      continue;
    }
    if (line.startsWith('### ')) { out.push(`<h4>${inline(esc(line.slice(4)))}</h4>`); i++; continue; }
    if (line.startsWith('## ')) { out.push(`<h3>${inline(esc(line.slice(3)))}</h3>`); i++; continue; }
    if (line.startsWith('# ')) { out.push(`<h2>${inline(esc(line.slice(2)))}</h2>`); i++; continue; }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(`<li>${inline(esc(lines[i].slice(2)))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(`<p>${inline(esc(line))}</p>`);
    i++;
  }
  return out.join('\n');
}

function statusLine(featurePct: number, checklistPct: number): string {
  if (featurePct === 0 && checklistPct === 0) return 'Concept stage';
  if (featurePct < 40) return 'Early production — core systems underway';
  if (featurePct < 80) return 'Mid production — systems coming together';
  return 'Feature-complete — polishing';
}

function statCard(label: string, value: string, pct?: number): string {
  const bar = pct != null
    ? `<div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`
    : '';
  return `<div class="stat"><div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div>${bar}</div>`;
}

function sectionHtml(section: GDDSection, depth = 0): string {
  const tag = depth === 0 ? 'h2' : 'h3';
  const parts = [`<section class="card"><${tag}>${esc(section.title)}</${tag}>`, mdToHtml(section.content)];
  if (section.mermaid) parts.push(`<div class="mermaid">${esc(section.mermaid)}</div>`);
  if (section.subsections) for (const sub of section.subsections) parts.push(sectionHtml(sub, depth + 1));
  parts.push('</section>');
  return parts.join('\n');
}

const STYLE = `
:root{--bg:#0e1117;--panel:#161b22;--line:#2a313c;--ink:#e6edf3;--muted:#9aa7b4;--accent:#7c9cff;--good:#3fb950;}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:48px 24px}
.hero{margin-bottom:32px}.hero h1{font-size:34px;margin:0 0 6px}.hero .meta{color:var(--muted);font-size:14px}
.status{display:inline-block;margin-top:14px;padding:6px 14px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font-size:14px;font-weight:600}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:24px 0 8px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.stat-value{font-size:26px;font-weight:700}.stat-label{color:var(--muted);font-size:13px;margin-top:2px}
.bar{height:6px;background:var(--line);border-radius:99px;margin-top:10px;overflow:hidden}.bar-fill{height:100%;background:var(--accent)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:18px 0}
.card h2{font-size:22px;margin:0 0 10px}.card h3{font-size:18px;margin:16px 0 8px}.card h4{font-size:15px;margin:12px 0 6px;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}th{color:var(--muted)}
ul{margin:8px 0;padding-left:20px}.mermaid{background:#0b0e14;border:1px solid var(--line);border-radius:8px;padding:14px;margin:12px 0;font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap;overflow-x:auto}
a{color:var(--accent)}
@media print{body{background:#fff;color:#111}.card,.stat,.mermaid{border-color:#ccc;background:#fff}.status{color:#111;border-color:#111}.card,.stat{break-inside:avoid}.stat-value{color:#111}}
`;

/**
 * Render a synthesized GDD as a self-contained, print-friendly single-page HTML
 * pitch a non-technical stakeholder can read with zero context. Diagrams render via
 * mermaid CDN; if offline/blocked, the `.mermaid` source stays readable (fallback).
 * Pure (no DOM / no fetch) so it is unit-testable.
 */
export function exportGDDAsPitchHTML(gdd: GDDDocument): string {
  const s = gdd.stats;
  const featurePct = s.totalFeatures > 0 ? Math.round((s.implementedFeatures / s.totalFeatures) * 100) : 0;
  const checklistPct = s.checklistTotal > 0 ? Math.round((s.checklistDone / s.checklistTotal) * 100) : 0;
  const generated = new Date(gdd.generatedAt).toLocaleDateString();

  const stats = [
    statCard('Feature Implementation', `${s.implementedFeatures}/${s.totalFeatures}`, featurePct),
    statCard('Development Checklist', `${s.checklistDone}/${s.checklistTotal}`, checklistPct),
    statCard('Levels', String(s.levelCount)),
    statCard('Audio Scenes', String(s.audioSceneCount)),
    statCard('Builds', String(s.buildCount)),
    statCard('Eval Findings', String(s.evalFindingCount)),
  ].join('');

  const body = gdd.sections.map((sec) => sectionHtml(sec)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(gdd.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${esc(gdd.title)}</h1>
    <div class="meta">Action RPG · Unreal Engine 5 · Generated ${esc(generated)}</div>
    <div class="status">${esc(statusLine(featurePct, checklistPct))}</div>
    <div class="stats">${stats}</div>
  </header>
  ${body}
</div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'dark' });
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/gdd-pitch.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gdd-pitch.ts src/__tests__/lib/gdd-pitch.test.ts
git commit -m "feat(gdd-pitch): pure self-contained pitch-HTML generator"
```

---

## Task 2: Wire the export-pitch API action

**Files:**
- Modify: `src/app/api/game-design-doc/route.ts`

- [ ] **Step 1: Add the import**

In `src/app/api/game-design-doc/route.ts`, change line 2 from:

```ts
import { synthesizeGDD, exportGDDAsMarkdown } from '@/lib/gdd-synthesizer';
```

to add the pitch import on the next line:

```ts
import { synthesizeGDD, exportGDDAsMarkdown } from '@/lib/gdd-synthesizer';
import { exportGDDAsPitchHTML } from '@/lib/gdd-pitch';
```

- [ ] **Step 2: Add the action branch**

In the `POST` handler, immediately after the `if (action === 'export-markdown') { … }` block and before `return apiError(\`Unknown action: ${action}\`, 400);`, insert:

```ts
    if (action === 'export-pitch') {
      const checklistProgress = checklist ?? {};
      const gdd = synthesizeGDD(projectName ?? 'Untitled Project', checklistProgress);
      const html = exportGDDAsPitchHTML(gdd);
      return apiSuccess({ html, title: gdd.title });
    }
```

- [ ] **Step 3: Verify typecheck of the route compiles**

Run: `npx tsc --noEmit 2>&1 | grep "api/game-design-doc/route" || echo "route OK"`
Expected: `route OK` (no type errors for this file).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/game-design-doc/route.ts
git commit -m "feat(gdd-pitch): add export-pitch action to the game-design-doc API"
```

---

## Task 3: Add exportPitch to the hook

**Files:**
- Modify: `src/hooks/useGameDesignDoc.ts`

- [ ] **Step 1: Extend the result interface**

In `src/hooks/useGameDesignDoc.ts`, in `interface UseGameDesignDocResult`, add after the `exportMarkdown` line:

```ts
  exportPitch: () => Promise<string | null>;
```

- [ ] **Step 2: Add the exportPitch callback**

Immediately after the `exportMarkdown` `useCallback` (before `return { … }`), add:

```ts
  const exportPitch = useCallback(async (): Promise<string | null> => {
    try {
      let checklistProgress = {};
      try {
        checklistProgress = JSON.parse(getChecklistJson());
      } catch { /* ignore */ }

      const data = await apiFetch<{ html: string }>('/api/game-design-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export-pitch',
          projectName,
          checklist: checklistProgress,
        }),
      });
      return data.html;
    } catch {
      return null;
    }
  }, [projectName, getChecklistJson]);
```

- [ ] **Step 3: Return it**

Change the return statement from:

```ts
  return { gdd, isLoading, error, generate, exportMarkdown };
```

to:

```ts
  return { gdd, isLoading, error, generate, exportMarkdown, exportPitch };
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "useGameDesignDoc" || echo "hook OK"`
Expected: `hook OK`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGameDesignDoc.ts
git commit -m "feat(gdd-pitch): add exportPitch to the useGameDesignDoc hook"
```

---

## Task 4: Add the Export Pitch button to the view

**Files:**
- Modify: `src/components/modules/evaluator/GameDesignDocView.tsx`

- [ ] **Step 1: Import the icon**

In the lucide-react import block (lines 4-8), add `Presentation` to the imported names, e.g. change `Layers, ClipboardCopy, Check,` to `Layers, ClipboardCopy, Check, Presentation,`.

- [ ] **Step 2: Destructure exportPitch + add state**

Change line 30 from:

```tsx
  const { gdd, isLoading, error, generate, exportMarkdown } = useGameDesignDoc(projectName);
```

to:

```tsx
  const { gdd, isLoading, error, generate, exportMarkdown, exportPitch } = useGameDesignDoc(projectName);
```

Then after the `const [exporting, setExporting] = useState(false);` line (line 34), add:

```tsx
  const [exportingPitch, setExportingPitch] = useState(false);
```

- [ ] **Step 3: Add the download handler**

Immediately after the `handleExport` `useCallback` (ends ~line 64), add:

```tsx
  const handleExportPitch = useCallback(async () => {
    setExportingPitch(true);
    const html = await exportPitch();
    setExportingPitch(false);
    if (!html) return;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-pitch.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportPitch, projectName]);
```

- [ ] **Step 4: Add the button**

In the toolbar, immediately after the `Export .md` `<button>…</button>` (the block ending at ~line 196), add:

```tsx
            <button
              onClick={handleExportPitch}
              disabled={exportingPitch}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
              title="Export a shareable single-page pitch (HTML)"
            >
              {exportingPitch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Presentation className="w-3 h-3" />}
              Export Pitch
            </button>
```

- [ ] **Step 5: Verify typecheck + lint of the view**

Run: `npx tsc --noEmit 2>&1 | grep "GameDesignDocView" || echo "view OK"`
Expected: `view OK`.
Run: `npx eslint src/components/modules/evaluator/GameDesignDocView.tsx src/hooks/useGameDesignDoc.ts src/lib/gdd-pitch.ts src/app/api/game-design-doc/route.ts`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/evaluator/GameDesignDocView.tsx
git commit -m "feat(gdd-pitch): Export Pitch button in the Game Design Doc view"
```

---

## Task 5: Validation + docs check

- [ ] **Step 1: Run the new test + typecheck my files**

Run: `npx vitest run src/__tests__/lib/gdd-pitch.test.ts`
Expected: PASS (6).
Run: `npx tsc --noEmit 2>&1 | grep -E "gdd-pitch|game-design-doc|useGameDesignDoc|GameDesignDocView" || echo "my files type-clean"`
Expected: `my files type-clean` (pre-existing foreign errors elsewhere are not mine).

- [ ] **Step 2: Docs sync check**

Run: `git grep -n "game-design-doc\|export-markdown" -- docs ':!docs/superpowers'`
If a doc enumerates the game-design-doc API actions, add `export-pitch` beside `export-markdown` there. If no match, no doc change is needed (the GDD export isn't a tracked architecture subsystem).

- [ ] **Step 3: Done.** The feature is complete when the new test passes and my four files are type/lint-clean.
