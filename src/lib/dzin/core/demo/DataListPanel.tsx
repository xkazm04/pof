import { useDensity } from '../density/DensityContext';
import { PanelFrame } from '../panel/PanelFrame';
import { MOCK_LIST_ITEMS } from './mockData';
import type { ListItem } from './mockData';

export interface DataListPanelProps {
  items?: ListItem[];
}

/**
 * Data list archetype panel demonstrating list-type rendering
 * across micro, compact, and full density modes.
 *
 * - **full**: Rich rows with avatar placeholder, name, description, status badge
 * - **compact**: Single-line rows with name and status dot
 * - **micro**: Item count badge only
 */
export function DataListPanel({ items = MOCK_LIST_ITEMS }: DataListPanelProps) {
  const density = useDensity();

  const statusColors: Record<string, string> = {
    active: '#22c55e',
    draft: '#94a3b8',
    review: '#f59e0b',
    archived: '#64748b',
  };

  return (
    <PanelFrame title="Data List">
      {density === 'micro' && (
        <div data-dzin-count-badge="">
          {items.length} items
        </div>
      )}

      {density === 'compact' && (
        <div data-dzin-list="">
          {items.map((item) => (
            <div key={item.id} data-dzin-list-item="" data-dzin-list-density="compact">
              <span data-dzin-item-name="">{item.name}</span>
              <span
                data-dzin-status-dot=""
                style={{ backgroundColor: statusColors[item.status] ?? '#94a3b8' }}
              />
            </div>
          ))}
        </div>
      )}

      {density === 'full' && (
        <div data-dzin-list="">
          {items.map((item) => (
            <div key={item.id} data-dzin-list-item="" data-dzin-list-density="full">
              <div
                data-dzin-avatar-placeholder=""
                style={{ backgroundColor: stringToColor(item.name) }}
              >
                {item.name.charAt(0)}
              </div>
              <div data-dzin-item-content="">
                <span data-dzin-item-name="">{item.name}</span>
                <span data-dzin-item-description="">{item.description}</span>
              </div>
              <span data-dzin-status-badge="" data-dzin-status={item.status}>
                <span
                  data-dzin-status-dot=""
                  style={{ backgroundColor: statusColors[item.status] ?? '#94a3b8' }}
                />
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelFrame>
  );
}

/** Deterministic color from a string for avatar placeholders. */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}
