import { useDensity } from '../density/DensityContext';
import { PanelFrame } from '../panel/PanelFrame';
import { MOCK_DETAIL } from './mockData';
import type { DetailEntity } from './mockData';

export interface DetailPanelProps {
  entity?: DetailEntity;
}

/**
 * Detail/editor archetype panel demonstrating entity-level display
 * across micro, compact, and full density modes.
 *
 * - **full**: All sections visible with field label-value pairs in 2-column layout
 * - **compact**: Only the first section's key fields in single-column layout
 * - **micro**: Entity name and type badge only
 */
export function DetailPanel({ entity = MOCK_DETAIL }: DetailPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title={entity.name}>
      {density === 'micro' && (
        <div data-dzin-detail-micro="">
          <span data-dzin-entity-name="">{entity.name}</span>
          <span data-dzin-type-badge="">{entity.type}</span>
        </div>
      )}

      {density === 'compact' && (
        <div data-dzin-detail-compact="">
          {entity.sections.slice(0, 1).map((section) => (
            <div key={section.title} data-dzin-detail-section="">
              <div data-dzin-section-title="">{section.title}</div>
              <div data-dzin-field-list="">
                {section.fields.map((field) => (
                  <div key={field.label} data-dzin-field="">
                    <span data-dzin-field-label="">{field.label}</span>
                    <span data-dzin-field-value="">{field.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {density === 'full' && (
        <div data-dzin-detail-full="">
          {entity.sections.map((section) => (
            <div key={section.title} data-dzin-detail-section="">
              <div data-dzin-section-title="">{section.title}</div>
              <div data-dzin-field-grid="">
                {section.fields.map((field) => (
                  <div key={field.label} data-dzin-field="">
                    <span data-dzin-field-label="">{field.label}</span>
                    <span data-dzin-field-value="">{field.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelFrame>
  );
}
