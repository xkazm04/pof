/**
 * eqs-squad-combat-spatial — one stage-kind vocabulary. The EQS pipeline diagram
 * and the squad PipelineView must label and color the same kind identically
 * (both read KIND_STYLE from the EQS catalog), and the inventory's coarser
 * kinds must reuse the catalog's colors.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PipelineView } from '@/components/modules/game-systems/SquadChoreographyEditor/PipelineView';
import { KIND_LABELS, KIND_LEGEND } from '@/components/modules/game-systems/EQSPipelineDiagram/constants';
import { KIND_META } from '@/components/modules/game-systems/EQSComponentInventory/constants';
import type { ComposedEQSStep, DirectorResult } from '@/types/squad-tactics';

afterEach(cleanup);

type Kind = keyof typeof KIND_LABELS;
const KINDS = Object.keys(KIND_LABELS) as Kind[];

const rgbOf = (color: string): string => {
  const el = document.createElement('span');
  el.style.color = color;
  return el.style.color;
};

function renderSquadBadges() {
  const steps: ComposedEQSStep[] = KINDS.map((kind) => ({
    label: `step-${kind}`, cppClass: '', kind, description: 'd', simulated: true,
  }));
  const result = { composedPipeline: steps } as unknown as DirectorResult;
  const { container } = render(<PipelineView result={result} />);
  return Array.from(container.querySelectorAll('ol > li')).map((li) => {
    const row = li.querySelector('div > div') as HTMLElement;
    const badge = row.lastElementChild as HTMLElement;
    return { label: badge.textContent, color: badge.style.color };
  });
}

describe('EQS stage kinds read one table', () => {
  it('squad PipelineView badge label and color match the pipeline diagram per kind', () => {
    const badges = renderSquadBadges();
    expect(badges.length).toBe(KINDS.length);
    KINDS.forEach((kind, i) => {
      expect(badges[i].label).toBe(KIND_LABELS[kind]);
      const legend = KIND_LEGEND.find((l) => l.kind === kind);
      if (legend) expect(badges[i].color).toBe(rgbOf(legend.color));
    });
  });

  it('inventory kind colors reuse the catalog colors', () => {
    const colorOf = (kind: Kind) => KIND_LEGEND.find((l) => l.kind === kind)!.color;
    expect(KIND_META.context.color).toBe(colorOf('context'));
    expect(KIND_META.generator.color).toBe(colorOf('generator'));
    expect(KIND_META.test.color).toBe(colorOf('test-score'));
  });
});
