import type { PanelDefinition } from '../registry/types';
import { DataListPanel } from './DataListPanel';
import { DetailPanel } from './DetailPanel';
import { MediaGridPanel } from './MediaGridPanel';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { DataListPanel } from './DataListPanel';
export type { DataListPanelProps } from './DataListPanel';
export { DetailPanel } from './DetailPanel';
export type { DetailPanelProps } from './DetailPanel';
export { MediaGridPanel } from './MediaGridPanel';
export type { MediaGridPanelProps } from './MediaGridPanel';
export { MOCK_LIST_ITEMS, MOCK_DETAIL, MOCK_MEDIA_ITEMS } from './mockData';
export type { ListItem, DetailEntity, DetailSection, MediaItem } from './mockData';

// ---------------------------------------------------------------------------
// Panel Definitions
// ---------------------------------------------------------------------------

/** Data list archetype: scrollable list with selection, badges, and status. */
export const dataListDefinition: PanelDefinition = {
  type: 'demo-data-list',
  label: 'Data List',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'low',
  domains: ['demo'],
  description: 'Scrollable list of items with selection, badges, and status indicators',
  capabilities: ['list-rendering', 'item-selection', 'status-display'],
  useCases: ['Browse a collection of items', 'Select an item for detail view'],
  inputs: [{ name: 'items', type: 'object', description: 'Array of list items', required: false }],
  outputs: [{ name: 'selectedItem', type: 'string', description: 'ID of selected item' }],
  densityModes: {
    micro: { minWidth: 80, minHeight: 40, description: 'Shows item count badge only' },
    compact: { minWidth: 200, minHeight: 150, description: 'Name-only item rows' },
    full: { minWidth: 300, minHeight: 300, description: 'Rich rows with avatars, descriptions, status badges' },
  },
  component: DataListPanel,
};

/** Detail view archetype: entity fields organized by section. */
export const detailDefinition: PanelDefinition = {
  type: 'demo-detail',
  label: 'Detail View',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'low',
  domains: ['demo'],
  description: 'Detail view of an entity with sectioned fields and metadata',
  capabilities: ['detail-display', 'field-sections', 'metadata-view'],
  useCases: ['View entity details', 'Inspect record fields and metrics'],
  inputs: [{ name: 'entity', type: 'object', description: 'Detail entity object', required: false }],
  outputs: [{ name: 'editedField', type: 'string', description: 'Name of field being edited' }],
  densityModes: {
    micro: { minWidth: 80, minHeight: 40, description: 'Shows entity name and type badge only' },
    compact: { minWidth: 200, minHeight: 120, description: 'Key fields from first section' },
    full: { minWidth: 350, minHeight: 300, description: 'All sections with 2-column field layout' },
  },
  component: DetailPanel,
};

/** Media grid archetype: visual grid of image/video thumbnails. */
export const mediaGridDefinition: PanelDefinition = {
  type: 'demo-media-grid',
  label: 'Media Gallery',
  defaultRole: 'primary',
  sizeClass: 'wide',
  complexity: 'medium',
  domains: ['demo'],
  description: 'Grid of media items with thumbnails, captions, and type badges',
  capabilities: ['grid-display', 'media-preview', 'thumbnail-rendering'],
  useCases: ['Browse media assets', 'Preview images and videos in a gallery'],
  inputs: [{ name: 'items', type: 'object', description: 'Array of media items', required: false }],
  outputs: [{ name: 'selectedMedia', type: 'string', description: 'ID of selected media item' }],
  densityModes: {
    micro: { minWidth: 80, minHeight: 40, description: 'Shows media count badge only' },
    compact: { minWidth: 200, minHeight: 150, description: 'Small thumbnail grid without captions' },
    full: { minWidth: 400, minHeight: 300, description: 'Full grid with thumbnails, titles, and type badges' },
  },
  component: MediaGridPanel,
};
