import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NO_CHECKLIST_MAPPING } from '@/types/gdd-compliance';
import { MappingStrip, mappingSentence } from '@/components/modules/evaluator/GDDComplianceView/MappingStrip';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('MappingStrip: an unmapped checklist item is named, not silently absent', () => {
  it('states the mapped share, so a short gap list is read against the scope', () => {
    expect(mappingSentence({
      ...NO_CHECKLIST_MAPPING, itemsTotal: 6, mapped: 5, noFeatureEvidence: 1, multiFeature: 2, unmapped: 1,
    })).toBe('4 of 6 items mapped to features · 1 declared un-evidenceable · 2 span multiple features · 1 unmapped');
  });

  it('lists the unmapped items and says they are invisible to the gap categories', () => {
    render(
      <MappingStrip
        mapping={{ ...NO_CHECKLIST_MAPPING, itemsTotal: 2, unmapped: 2 }}
        unmappedItems={[
          { id: 'viewer-load', label: 'Load 3D model', fallback: 'none' },
          { id: 'viewer-grid', label: 'Add grid & axis helper', fallback: 'none' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Load 3D model')).toBeTruthy();
    expect(screen.getAllByText(/invisible to the checklist gap categories/)).toHaveLength(2);
  });

  it('says out loud when a feature was matched by the substring guess', () => {
    render(
      <MappingStrip
        mapping={{ ...NO_CHECKLIST_MAPPING, itemsTotal: 1, heuristic: 1 }}
        unmappedItems={[
          { id: 'viewer-load', label: 'Load 3D model', fallback: 'heuristic', heuristicFeature: 'Load 3D model loader' },
        ]}
      />,
    );
    expect(screen.getByText(/guessed by label substring/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/a label-substring guess \(verify it\)/)).toBeTruthy();
  });

  it('renders nothing for a module with no checklist', () => {
    const { container } = render(<MappingStrip mapping={NO_CHECKLIST_MAPPING} unmappedItems={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
