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
