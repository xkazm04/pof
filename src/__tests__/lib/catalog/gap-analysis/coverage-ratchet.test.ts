// @vitest-environment node
/**
 * Coverage ratchet — a gap-analysis plugin's declared dimensions must read its own catalog.
 *
 * The plugins declare their dimensions by hand; nothing checked them against the data they
 * read, so a stale plugin produced an empty histogram that analyzeCatalog silently dropped.
 * This walks every CATALOG_SECTIONS catalog with a registered plugin against its CODE seed
 * and pins the catalogs whose declared dimensions cover 0 entities of that seed. The
 * allowlists are ENUMERATED and may only shrink: a newly stale plugin fails here, and a
 * plugin fixed to read its data must be removed from the list.
 *
 * Catalogs whose code seed is EMPTY (0 of 0) cannot be measured either way — they are
 * pinned in their own list rather than silently excluded (absence is never exemption).
 */
import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { codeSeededEntities } from '@/lib/catalog/seed';
import { pluginFor } from '@/lib/catalog/gap-analysis/plugins';
import { unmeasuredDimensions } from '@/lib/catalog/gap-analysis/coverage';

/** Catalogs whose declared dimensions cover 0 of their code seed (2026-09-27). Shrink only. */
const STALE_PLUGIN_ALLOWLIST = [
  'quests', 'dialog-trees', 'codex', 'props', 'status-effects', 'crafting-recipes', 'vendors',
  'progression-curves', 'achievements', 'save-points', 'music', 'ambient', 'vfx', 'hud-elements',
  'icon-sets', 'input-schemes', 'tutorial-beats', 'currencies',
].sort();

/** Catalogs with a plugin but an empty code seed — unmeasurable (0 of 0). Shrink only. */
const EMPTY_SEED_ALLOWLIST = ['animation-assets', 'audio'].sort();

const withPlugin = CATALOG_SECTIONS.map((s) => s.catalogId).filter((id) => pluginFor(id));

describe('gap-analysis coverage ratchet', () => {
  it('the set of catalogs with a stale plugin equals the enumerated allowlist', () => {
    const stale = withPlugin
      .filter((id) => codeSeededEntities(id).length > 0)
      .filter((id) => unmeasuredDimensions(id, codeSeededEntities(id)).length > 0)
      .sort();
    expect(stale).toEqual(STALE_PLUGIN_ALLOWLIST);
  });

  it('the set of plugin catalogs with an empty code seed equals the enumerated allowlist', () => {
    const empty = withPlugin.filter((id) => codeSeededEntities(id).length === 0).sort();
    expect(empty).toEqual(EMPTY_SEED_ALLOWLIST);
  });

  it('a plugin whose dimensions read its seed reports nothing unmeasured', () => {
    expect(unmeasuredDimensions('items', codeSeededEntities('items'))).toEqual([]);
  });
});
