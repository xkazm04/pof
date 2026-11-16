import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { EditorTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EditorTab';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/**
 * scan-sweep inventory-genome-economy: every EditorTab control has a programmatic name.
 * The captions (Name / Type / MinRar / Rate / Max / Wild) were bare <span>s and the
 * delete control an icon-only button, so a screen reader announced "edit text",
 * "combo box", "spin button", "button" with no name. RollerTab already ties its
 * captions to its controls with useId + htmlFor; this pins the same for the editor.
 */

afterEach(cleanup);

function renderTab() {
  const genome = createGenome('Probe', ACCENT_VIOLET, {});
  render(
    <EditorTab
      selected={genome}
      radarData={[]}
      genomeCount={2}
      updateGenome={() => {}}
      updateTrait={() => {}}
      deleteGenome={() => {}}
    />,
  );
}

describe('EditorTab control names', () => {
  it('names the metadata fields', () => {
    renderTab();
    expect(screen.getByLabelText('Name').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Type').tagName).toBe('SELECT');
    expect(screen.getByLabelText('MinRar').tagName).toBe('SELECT');
  });

  it('names the mutation config fields', () => {
    renderTab();
    expect(screen.getByLabelText('Rate').getAttribute('type')).toBe('number');
    expect(screen.getByLabelText('Max').getAttribute('type')).toBe('number');
    const wild = screen.getByRole('button', { name: /wild mutation/i });
    expect(wild.getAttribute('aria-pressed')).toBe('false');
  });

  it('names the icon-only delete button', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /delete genome/i })).toBeTruthy();
  });
});
