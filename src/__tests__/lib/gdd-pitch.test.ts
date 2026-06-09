import { describe, it, expect } from 'vitest';
import { exportGDDAsPitchHTML, exportGDDAsPrintableHTML } from '@/lib/gdd-pitch';
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

describe('exportGDDAsPrintableHTML', () => {
  const html = exportGDDAsPrintableHTML(fixture);

  it('is a full self-contained HTML document with the title', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Pillars of Fortune — Game Design Document');
  });

  it('leads with a compliance-scorecard cover page that breaks before the body', () => {
    expect(html).toContain('class="cover"');
    expect(html).toContain('Compliance Scorecard');
    expect(html).toContain('page-break-after:always');
    // Scorecard headline percentages derived from stats (3/10 = 30%, 5/20 = 25%).
    expect(html).toContain('30%');
    expect(html).toContain('25%');
  });

  it('still carries the full GDD body + diagrams (reuses the pitch render)', () => {
    expect(html).toContain('Project Overview');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('pie title Feature Implementation Status');
  });

  it('embeds an auto-print trigger that runs after mermaid renders', () => {
    expect(html).toContain('window.print()');
    expect(html).toContain('mermaid.run()');
    expect(html).toMatch(/mermaid@11/);
  });

  it('HTML-escapes content in the printable build too', () => {
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
