import { createElement, type CSSProperties } from 'react';
import { archetypeIcon } from '../_shared/data';

/**
 * Renders an archetype's icon from its `iconKey`. The component is looked up at render time
 * rather than carried on the archetype, because archetypes are persisted as JSON and a
 * component does not survive that (see `ARCHETYPE_ICONS`). An absent or unknown key — an
 * ingested or older persisted entity — renders the generic enemy glyph, never nothing.
 */
export function ArchetypeIconGlyph({ archetype, className, style }: {
  archetype: { iconKey?: string };
  className?: string;
  style?: CSSProperties;
}) {
  return createElement(archetypeIcon(archetype), { className, style, 'aria-hidden': true });
}
