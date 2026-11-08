/**
 * scan-sweep 2026-11-08 — blueprint-transpiler-game-systems hardening.
 * One describe per landed finding; each was seen red before its fix.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/blueprint-transpiler/route';
import { resetBlueprintTranspilerSessions } from '@/hooks/useBlueprintTranspiler';
import { ReplicationScaffoldPanel } from '@/components/modules/game-systems/multiplayer/ReplicationScaffoldPanel';
import { useProjectStore } from '@/stores/projectStore';
import { TranspilePane } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/TranspilePane';
import { DiffPane } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/DiffPane';
import { QuestGeneratorPanel } from '@/components/modules/game-systems/DialogueView/QuestGeneratorPanel';
import { ChangeCard } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/ChangeCard';
import type { SemanticChange } from '@/types/blueprint';

afterEach(() => cleanup());

function change(partial: Partial<SemanticChange> = {}): SemanticChange {
  return {
    id: 'c1',
    type: 'add',
    scope: 'variable',
    name: 'Health',
    description: 'Health exists in the Blueprint but not in C++',
    conflictLevel: 'compatible',
    ...partial,
  } as SemanticChange;
}

describe('ChangeCard — the expand toggle is reachable by keyboard', () => {
  it('renders the toggle as a button carrying aria-expanded', () => {
    const { container } = render(<ChangeCard change={change()} />);
    const toggle = container.querySelector('button[aria-expanded]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    // No click handler on a non-interactive wrapper (mouse-only door).
    expect(container.querySelector('div[class*="cursor-pointer"]')).toBeNull();
  });

  it('expands on activation and exposes the detail panel it controls', () => {
    const { container } = render(<ChangeCard change={change()} />);
    const toggle = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = container.querySelector(`[id="${panelId}"]`);
    expect(panel?.textContent).toContain('Health exists in the Blueprint');
  });
});

describe('ReplicationScaffoldPanel - copy goes through the shared CopyButton', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a denied clipboard write neither rejects unhandled nor claims success', async () => {
    resetBlueprintTranspilerSessions();
    useProjectStore.setState({ projectName: 'P', projectPath: 'C:/proj' });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) =>
      POST(new NextRequest(`http://localhost${url}`, init as ConstructorParameters<typeof NextRequest>[1]))));
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const unhandled: unknown[] = [];
    const onUnhandled = (r: unknown) => { unhandled.push(r); };
    process.on('unhandledRejection', onUnhandled);
    try {
      render(<ReplicationScaffoldPanel />);
      fireEvent.click(screen.getByText('Load Sample'));
      await act(async () => { fireEvent.click(screen.getByText('Scan Replication')); });
      await screen.findByText('Generated replication boilerplate');
      const copy = screen.getByRole('button', { name: /copy/i });
      await act(async () => { fireEvent.click(copy); });
      await new Promise((r) => setTimeout(r, 0));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
      expect(screen.queryByText('Copied')).toBeNull();
      expect(screen.getByRole('button', { name: /copy/i }).getAttribute('aria-label')).not.toMatch(/copied/i);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('the Blueprint / C++ input boxes have accessible names (not placeholder-only)', () => {
  it('names every textarea across the transpile, diff and replication surfaces', () => {
    const noop = () => {};
    const { container } = render(
      <>
        <TranspilePane
          blueprintJson="" setBlueprintJson={noop} onTranspile={noop} onLoadSample={noop}
          isLoading={false} error={null} asset={null} summary={null} result={null}
          showCode="header" setShowCode={noop} moduleName="P" onModuleChange={noop} projectPath=""
        />
        <DiffPane
          blueprintJson="" setBlueprintJson={noop} existingCpp="" setExistingCpp={noop}
          onDiff={noop} onLoadSample={noop} isLoading={false} error={null} result={null}
        />
        <ReplicationScaffoldPanel />
      </>,
    );
    const boxes = Array.from(container.querySelectorAll('textarea'));
    expect(boxes).toHaveLength(4);
    const named = boxes.filter((b) => (b.getAttribute('aria-label') ?? '').trim().length > 0);
    expect(named).toHaveLength(4);
  });
});

describe('quest difficulty pips use chart-colors tokens, not hex', () => {
  it('DialogueView/constants.ts carries no hex literal and five distinct pip colours', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src/components/modules/game-systems/DialogueView/constants.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    const { DIFFICULTY_COLORS } = await import('@/components/modules/game-systems/DialogueView/constants');
    expect(new Set(DIFFICULTY_COLORS).size).toBe(5);
  });
});

describe('TranspilePane - a re-transpile does not stack a full-height spinner over the code', () => {
  it('keeps the previous code as the only flex-1 region while a new run is in flight', () => {
    const noop = () => {};
    render(
      <TranspilePane
        blueprintJson="{}" setBlueprintJson={noop} onTranspile={noop} onLoadSample={noop}
        isLoading error={null} asset={null} summary={null}
        result={{
          headerCode: '#pragma once', sourceCode: '// body', className: 'AHero', parentClass: 'ACharacter',
          includes: [], warnings: [], nodeCount: 1, functionCount: 0,
          replication: { hasReplication: false, properties: [] },
        }}
        showCode="header" setShowCode={noop} moduleName="P" onModuleChange={noop} projectPath=""
      />,
    );
    expect(screen.getByTestId('transpile-fidelity')).not.toBeNull();
    expect(screen.queryByText('Transpiling Blueprint graph...')).toBeNull();
  });
});

describe('badge tints use the opacity tokens, not a raw hex-alpha suffix', () => {
  it('ChangeCard and QuestCard append no literal two-digit alpha to a colour', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files = [
      'src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/ChangeCard.tsx',
      'src/components/modules/game-systems/DialogueView/QuestCard.tsx',
    ];
    const hits = files.flatMap((f) => {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      return (src.match(/\$\{[^}]+\}[0-9a-fA-F]{2}`/g) ?? []).map((m) => `${f}: ${m}`);
    });
    expect(hits).toEqual([]);
  });
});

describe('QuestGeneratorPanel - a failed level-doc load is said, not swallowed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows why the level-doc picker is missing when GET /api/quest-generation fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, error: 'db locked' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )));
    render(<QuestGeneratorPanel />);
    const note = await screen.findByTestId('level-docs-error');
    expect(note.textContent).toContain('db locked');
  });
});

describe('QuestGeneratorPanel - the JSON export defers the blob revoke', () => {
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  });

  it('does not revoke the blob URL synchronously after the download click', async () => {
    const quest = {
      id: 'q1', name: 'Q', category: 'main', description: 'd', difficulty: 1,
      objectives: [], roomPath: [], dialogue: [], sourceHint: 's', rewards: [],
    };
    const result = {
      generatedAt: '2026-11-08T00:00:00.000Z',
      worldScan: { actors: [], enemyClasses: [], npcClasses: [], interactableClasses: [], itemClasses: [] },
      levelDocId: null, levelDocName: null, quests: [quest], coherenceNotes: [],
    };
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => new Response(
      JSON.stringify({ success: true, data: init?.method === 'POST' ? { result } : { docs: [] } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    const revoke = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = revoke;
    render(<QuestGeneratorPanel />);
    fireEvent.click(screen.getByText('Generate Quests'));
    const btn = await screen.findByText('Download .json');
    vi.useFakeTimers();
    fireEvent.click(btn);
    expect(revoke).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});

describe('transpiler tabs and the .h/.cpp toggle expose their selected state', () => {
  it('has exactly one aria-selected tab and one aria-pressed code toggle', async () => {
    const { BlueprintTranspilerView } = await import(
      '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView'
    );
    const { container } = render(<BlueprintTranspilerView />);
    expect(container.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBe(1);
    cleanup();
    const noop = () => {};
    const view = render(
      <TranspilePane
        blueprintJson="{}" setBlueprintJson={noop} onTranspile={noop} onLoadSample={noop}
        isLoading={false} error={null} asset={null} summary={null}
        result={{
          headerCode: '#pragma once', sourceCode: '// body', className: 'AHero', parentClass: 'ACharacter',
          includes: [], warnings: [], nodeCount: 1, functionCount: 0,
          replication: { hasReplication: false, properties: [] },
        }}
        showCode="header" setShowCode={noop} moduleName="P" onModuleChange={noop} projectPath=""
      />,
    );
    expect(view.container.querySelectorAll('[aria-pressed]').length).toBe(2);
    expect(view.container.querySelectorAll('[aria-pressed="true"]').length).toBe(1);
  });
});

describe('WriteToProjectButton - the status banners share one block', () => {
  it('has a single tinted-banner style block, not one per banner', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      'src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx',
      'utf-8',
    );
    expect(src.split('OPACITY_10}`').length - 1).toBe(1);
  });
});

describe('status hues use the STATUS_* tokens, not raw palette classes', () => {
  it('has no text-(red|amber|green|yellow|blue|purple)-400 in the context files', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const roots = [
      'src/components/modules/game-systems/blueprint-transpiler',
      'src/components/modules/game-systems/DialogueView',
      'src/components/modules/game-systems/multiplayer',
    ];
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.tsx') ? [`${d}/${e.name}`] : []);
    const hits: string[] = [];
    for (const f of roots.flatMap(walk)) {
      const code = readFileSync(f, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.matchAll(/(?:text|bg|border)-(?:red|amber|green|yellow|blue|purple)-400/g)) hits.push(`${f}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });
});

describe('ChangeCard - the conflict level is a glyph with a name, not a hue-only dot', () => {
  it('exposes the conflict label per card', () => {
    const { container } = render(<ChangeCard change={change({ conflictLevel: 'conflict' })} />);
    const mark = container.querySelector('svg[role="img"]');
    expect(mark?.getAttribute('aria-label')).toBe('Conflicts Detected');
    cleanup();
    const again = render(<ChangeCard change={change({ conflictLevel: 'compatible' })} />);
    expect(again.container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe('Compatible Changes');
  });
});

describe('QuestGeneratorPanel - metric tiles follow CATEGORY_LABELS', () => {
  const realCreate = URL.createObjectURL;
  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = realCreate;
  });

  it('renders one tile per CATEGORY_LABELS key, including a newly added category', async () => {
    const { CATEGORY_LABELS } = await import('@/components/modules/game-systems/DialogueView/constants');
    const labels = CATEGORY_LABELS as Record<string, { label: string; color: string }>;
    labels.zzprobe = { label: 'ZzProbe', color: labels.main.color };
    try {
      const result = {
        generatedAt: '2026-11-08T00:00:00.000Z',
        worldScan: { actors: [], enemyClasses: [], npcClasses: [], interactableClasses: [], itemClasses: [] },
        levelDocId: null, levelDocName: null, quests: [], coherenceNotes: [],
      };
      vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => new Response(
        JSON.stringify({ success: true, data: init?.method === 'POST' ? { result } : { docs: [] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )));
      render(<QuestGeneratorPanel />);
      fireEvent.click(screen.getByText('Generate Quests'));
      await screen.findByText('ZzProbe');
      for (const k of Object.keys(CATEGORY_LABELS)) {
        expect(screen.getAllByText(CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS].label).length).toBeGreaterThan(0);
      }
    } finally {
      delete labels.zzprobe;
    }
  });
});
