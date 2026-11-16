/**
 * scan-sweep (cross-module-features): the Evaluator's tab strip and its content
 * branches are two hand-typed lists in EvaluatorModule/index.tsx (31 TabButtons,
 * 31 `activeTab === '<id>' &&` branches). The glossary test checks the glossary
 * against a THIRD hand-copied list, so a tab id with no chip, or a chip whose
 * panel branch was never written (a blank page), passed every test. This file
 * derives both from the ground truth, EVALUATOR_TAB_INFO.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mockFetch } from '@/__tests__/setup';
import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { evaluatorTabDomId } from '@/components/modules/evaluator/EvaluatorModule/TabControls';
import { EVALUATOR_TAB_INFO, EVALUATOR_SECTIONS, type EvaluatorTabId } from '@/lib/evaluator/tab-glossary';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);
beforeEach(() => { mockFetch({ body: { success: true, data: {} } }); });

const GLOSSARY_IDS = Object.keys(EVALUATOR_TAB_INFO) as EvaluatorTabId[];
const SHELL = path.join(process.cwd(), 'src/components/modules/evaluator/EvaluatorModule/index.tsx');

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Ids of the glossary that `has` does not cover. */
const uncovered = (has: (id: EvaluatorTabId) => boolean) => GLOSSARY_IDS.filter((id) => !has(id));

describe('EvaluatorModule — every glossary tab has a chip and a panel', () => {
  it('renders exactly one chip per glossary id, and no other', () => {
    render(<EvaluatorModule />);
    const rendered = screen.getAllByRole('tab').map((t) => t.id);
    expect(rendered.length).toBe(GLOSSARY_IDS.length);
    expect(uncovered((id) => rendered.includes(evaluatorTabDomId(id)))).toEqual([]);
  });

  it('writes a content branch for every glossary id', () => {
    const src = stripComments(readFileSync(SHELL, 'utf-8'));
    expect(uncovered((id) => src.includes(`activeTab === '${id}' &&`))).toEqual([]);
  });

  it('prints a divider for every section after the first (Analysis leads undivided)', () => {
    render(<EvaluatorModule />);
    const tablist = screen.getByRole('tablist');
    for (const section of EVALUATOR_SECTIONS.slice(1)) {
      expect(tablist.textContent, section.label).toContain(section.label);
    }
  });

  it('the coverage check bites on a seeded gap', () => {
    const seeded = stripComments("{activeTab === 'overview' && <X/>}\n// activeTab === 'nexus' &&");
    expect(uncovered((id) => seeded.includes(`activeTab === '${id}' &&`))).toContain('nexus');
  });
});
