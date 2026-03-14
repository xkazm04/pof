import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DensityProvider } from '../../density';
import { DataListPanel } from '../DataListPanel';
import { DetailPanel } from '../DetailPanel';
import { MediaGridPanel } from '../MediaGridPanel';
import { dataListDefinition, detailDefinition, mediaGridDefinition } from '../index';
import { MOCK_LIST_ITEMS, MOCK_DETAIL, MOCK_MEDIA_ITEMS } from '../mockData';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// DataListPanel
// ---------------------------------------------------------------------------
describe('DataListPanel', () => {
  it('at full density renders list items with names, descriptions, and status badges', () => {
    const { container } = render(
      <DensityProvider density="full">
        <DataListPanel />
      </DensityProvider>,
    );
    // Should have item rows
    const items = container.querySelectorAll('[data-dzin-list-item]');
    expect(items.length).toBe(MOCK_LIST_ITEMS.length);
    // First item should show name, description, and status
    const firstItem = items[0];
    expect(firstItem.textContent).toContain('Aurora Campaign');
    expect(firstItem.textContent).toContain('Q4 brand awareness');
    expect(container.querySelector('[data-dzin-status-badge]')).toBeTruthy();
  });

  it('at compact density renders list items with names only (no descriptions)', () => {
    const { container } = render(
      <DensityProvider density="compact">
        <DataListPanel />
      </DensityProvider>,
    );
    const items = container.querySelectorAll('[data-dzin-list-item]');
    expect(items.length).toBe(MOCK_LIST_ITEMS.length);
    // Should have names but NOT descriptions
    expect(items[0].textContent).toContain('Aurora Campaign');
    expect(items[0].textContent).not.toContain('Q4 brand awareness');
  });

  it('at micro density renders only an item count badge', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <DataListPanel />
      </DensityProvider>,
    );
    // No list items at micro
    const items = container.querySelectorAll('[data-dzin-list-item]');
    expect(items.length).toBe(0);
    // Should show count
    const badge = container.querySelector('[data-dzin-count-badge]');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('8');
    expect(badge!.textContent).toMatch(/items/i);
  });
});

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------
describe('DetailPanel', () => {
  it('at full density renders all sections with field labels and values', () => {
    const { container } = render(
      <DensityProvider density="full">
        <DetailPanel />
      </DensityProvider>,
    );
    // Should have all 3 sections
    const sections = container.querySelectorAll('[data-dzin-detail-section]');
    expect(sections.length).toBe(MOCK_DETAIL.sections.length);
    // Overview section should have Status, Priority, Owner, Created
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('Sarah Chen');
    // Metrics section
    expect(container.textContent).toContain('2.4M');
  });

  it('at compact density renders key fields only in compact layout', () => {
    const { container } = render(
      <DensityProvider density="compact">
        <DetailPanel />
      </DensityProvider>,
    );
    // Should show only first section's fields
    const sections = container.querySelectorAll('[data-dzin-detail-section]');
    expect(sections.length).toBe(1);
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Active');
    // Should NOT contain metrics from later sections
    expect(container.textContent).not.toContain('2.4M');
  });

  it('at micro density renders entity name and type badge only', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <DetailPanel />
      </DensityProvider>,
    );
    // No detail sections at micro
    const sections = container.querySelectorAll('[data-dzin-detail-section]');
    expect(sections.length).toBe(0);
    // Should show entity name and type badge
    expect(container.textContent).toContain('Aurora Campaign');
    const badge = container.querySelector('[data-dzin-type-badge]');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('Campaign');
  });
});

// ---------------------------------------------------------------------------
// MediaGridPanel
// ---------------------------------------------------------------------------
describe('MediaGridPanel', () => {
  it('at full density renders image placeholders with captions', () => {
    const { container } = render(
      <DensityProvider density="full">
        <MediaGridPanel />
      </DensityProvider>,
    );
    const items = container.querySelectorAll('[data-dzin-media-item]');
    expect(items.length).toBe(MOCK_MEDIA_ITEMS.length);
    // Should have placeholders and captions
    expect(container.querySelector('[data-dzin-media-placeholder]')).toBeTruthy();
    expect(container.textContent).toContain('Hero Banner - Desktop');
  });

  it('at compact density renders smaller thumbnails without captions', () => {
    const { container } = render(
      <DensityProvider density="compact">
        <MediaGridPanel />
      </DensityProvider>,
    );
    const items = container.querySelectorAll('[data-dzin-media-item]');
    expect(items.length).toBe(MOCK_MEDIA_ITEMS.length);
    // Placeholders should exist but no captions
    expect(container.querySelector('[data-dzin-media-placeholder]')).toBeTruthy();
    expect(container.textContent).not.toContain('Hero Banner - Desktop');
  });

  it('at micro density renders image count badge only', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <MediaGridPanel />
      </DensityProvider>,
    );
    const items = container.querySelectorAll('[data-dzin-media-item]');
    expect(items.length).toBe(0);
    const badge = container.querySelector('[data-dzin-count-badge]');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('9');
  });
});

// ---------------------------------------------------------------------------
// PanelDefinitions metadata
// ---------------------------------------------------------------------------
describe('PanelDefinitions', () => {
  it('each demo panel has a valid PanelDefinition with correct metadata', () => {
    // DataListPanel definition
    expect(dataListDefinition.type).toBe('demo-data-list');
    expect(dataListDefinition.label).toBe('Data List');
    expect(dataListDefinition.domains).toContain('demo');
    expect(dataListDefinition.densityModes.micro).toBeDefined();
    expect(dataListDefinition.densityModes.compact).toBeDefined();
    expect(dataListDefinition.densityModes.full).toBeDefined();
    expect(dataListDefinition.component).toBe(DataListPanel);

    // DetailPanel definition
    expect(detailDefinition.type).toBe('demo-detail');
    expect(detailDefinition.label).toBe('Detail View');
    expect(detailDefinition.domains).toContain('demo');
    expect(detailDefinition.densityModes.micro).toBeDefined();
    expect(detailDefinition.densityModes.compact).toBeDefined();
    expect(detailDefinition.densityModes.full).toBeDefined();
    expect(detailDefinition.component).toBe(DetailPanel);

    // MediaGridPanel definition
    expect(mediaGridDefinition.type).toBe('demo-media-grid');
    expect(mediaGridDefinition.label).toBe('Media Gallery');
    expect(mediaGridDefinition.domains).toContain('demo');
    expect(mediaGridDefinition.densityModes.micro).toBeDefined();
    expect(mediaGridDefinition.densityModes.compact).toBeDefined();
    expect(mediaGridDefinition.densityModes.full).toBeDefined();
    expect(mediaGridDefinition.component).toBe(MediaGridPanel);
  });
});
