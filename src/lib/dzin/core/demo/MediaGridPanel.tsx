import { useDensity } from '../density/DensityContext';
import { PanelFrame } from '../panel/PanelFrame';
import { MOCK_MEDIA_ITEMS } from './mockData';
import type { MediaItem } from './mockData';

export interface MediaGridPanelProps {
  items?: MediaItem[];
}

/** Deterministic gradient for placeholder thumbnails. */
function itemGradient(index: number): string {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  ];
  return gradients[index % gradients.length];
}

/**
 * Media grid archetype panel demonstrating grid/visual content rendering
 * across micro, compact, and full density modes.
 *
 * - **full**: CSS Grid of cards with placeholder, title, and type badge
 * - **compact**: Smaller grid cells with placeholder only (no captions)
 * - **micro**: Image count badge only
 */
export function MediaGridPanel({ items = MOCK_MEDIA_ITEMS }: MediaGridPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Media Gallery">
      {density === 'micro' && (
        <div data-dzin-count-badge="">
          {items.length} images
        </div>
      )}

      {density === 'compact' && (
        <div data-dzin-media-grid="" data-dzin-grid-density="compact">
          {items.map((item, index) => (
            <div key={item.id} data-dzin-media-item="">
              <div
                data-dzin-media-placeholder=""
                style={{ background: itemGradient(index), aspectRatio: '1' }}
              />
            </div>
          ))}
        </div>
      )}

      {density === 'full' && (
        <div data-dzin-media-grid="" data-dzin-grid-density="full">
          {items.map((item, index) => (
            <div key={item.id} data-dzin-media-item="">
              <div
                data-dzin-media-placeholder=""
                style={{ background: itemGradient(index), aspectRatio: '16/9' }}
              />
              <div data-dzin-media-caption="">
                <span data-dzin-media-title="">{item.title}</span>
                <span data-dzin-media-type-badge="">{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelFrame>
  );
}
