/**
 * The workbench's toggle groups expose which option is selected (aria-pressed),
 * its collapsible Crafting Station exposes aria-expanded, and every icon-only
 * button and search box has an accessible name - selection was colour-only.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AffixPoolPanel } from '@/components/modules/core-engine/sub_loot/affix-workbench/AffixPoolPanel';
import { BreakpointFilters } from '@/components/modules/core-engine/sub_loot/affix-workbench/BreakpointFilters';
import { WorkbenchHeader } from '@/components/modules/core-engine/sub_loot/affix-workbench/WorkbenchHeader';
import { ItemBaseSelector } from '@/components/modules/core-engine/sub_loot/affix-workbench/ItemBaseSelector';
import { ItemPreviewCard } from '@/components/modules/core-engine/sub_loot/affix-workbench/ItemPreviewCard';
import { CraftingStation } from '@/components/modules/core-engine/sub_loot/affix-workbench/CraftingStation';
import { AFFIX_POOL, ITEM_BASES } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { getCategoryColor } from '@/components/modules/core-engine/sub_loot/affix-workbench/constants';
import { defaultWallet, instantiateAffix } from '@/components/modules/core-engine/sub_loot/affix-workbench/craftingKernel';

afterEach(() => cleanup());
const noop = () => {};

const pressed = (root: HTMLElement, labels: string[]) => labels.map((l) => {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent?.trim().toLowerCase() === l.toLowerCase());
  return b?.getAttribute('aria-pressed') ?? 'missing';
});
const accessibleName = (el: Element) => el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? '';

describe('affix workbench — selection state and names', () => {
  it('the pool category filter marks the active category', () => {
    const { container } = render(
      <AffixPoolPanel filteredPool={AFFIX_POOL.slice(0, 2)} poolFilter="defensive" setPoolFilter={noop} poolSearch=""
        setPoolSearch={noop} maxAffixes={4} craftedAffixCount={0} rarityColor="red" rarity="Rare" canAddMore
        draggingAffixId={null} maxWeight={1} totalWeight={2} onAddAffix={noop} onDragStart={noop} onDragEnd={noop}
        getCategoryColor={getCategoryColor} />,
    );
    expect(pressed(container, ['all', 'offensive', 'defensive', 'utility'])).toEqual(['false', 'false', 'true', 'false']);
    expect(accessibleName(container.querySelector('input')!)).not.toBe('');
    const adds = [...container.querySelectorAll('button')].filter((b) => !b.textContent?.trim());
    expect(adds.map(accessibleName)).toEqual([`Add ${AFFIX_POOL[0].displayName}`, `Add ${AFFIX_POOL[1].displayName}`]);
  });

  it('the breakpoint filters mark the active category and rarity, and name the search box', () => {
    const { container } = render(
      <BreakpointFilters bpCategoryFilter="utility" setBpCategoryFilter={noop} bpRarityFilter="Epic"
        setBpRarityFilter={noop} bpSearch="" setBpSearch={noop} resultCount={3} />,
    );
    expect(pressed(container, ['all', 'utility', 'Epic', 'Rare'])).toEqual(['false', 'true', 'true', 'false']);
    expect(accessibleName(container.querySelector('input')!)).not.toBe('');
  });

  it('the header view toggle marks the active view and names the icon-only clear button', () => {
    const { container } = render(
      <WorkbenchHeader viewMode="workbench" setViewMode={noop} onRandomRoll={noop} onClear={noop} showExport={false}
        onToggleExport={noop} onInjectToUE5={noop} ue5Status="disconnected" craftedAffixCount={0}
        injectStatus="idle" injectError={null} />,
    );
    expect(pressed(container, ['Workbench', 'Breakpoints'])).toEqual(['true', 'false']);
    const iconOnly = [...container.querySelectorAll('button')].filter((b) => !b.textContent?.trim());
    expect(iconOnly.length).toBeGreaterThan(0);
    expect(iconOnly.map(accessibleName).filter((n) => !n)).toEqual([]);
  });

  it('the item-base picker marks the selected base', () => {
    const { container } = render(
      <ItemBaseSelector selectedBase={ITEM_BASES[2]} itemLevel={25} onSelectBase={noop} onSetItemLevel={noop} />,
    );
    const states = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'));
    expect(states).toEqual(ITEM_BASES.map((_, i) => (i === 2 ? 'true' : 'false')));
  });

  it('each crafted affix has a named remove button', () => {
    const affix = instantiateAffix(AFFIX_POOL[0]);
    const { container } = render(
      <ItemPreviewCard selectedBase={ITEM_BASES[2]} craftedAffixes={[affix]} fullItemName="x" itemLevel={25}
        dragOverItem={false} onDragOver={noop} onDragLeave={noop} onDrop={noop} onRemoveAffix={noop}
        onUpdateMagnitude={noop} onTogglePlacement={noop} onSetPreviewTag={noop} maxAffixes={4} />,
    );
    const iconOnly = [...container.querySelectorAll('button')].filter((b) => !b.textContent?.trim());
    expect(iconOnly.map(accessibleName)).toEqual([`Remove ${affix.displayName}`]);
  });

  it('the Crafting Station toggle exposes whether the panel is open', () => {
    const { container } = render(
      <CraftingStation showCraftPanel={false} onToggleCraftPanel={noop} prefixLocked={false} suffixLocked={false}
        craftCount={0} wallet={defaultWallet()} craftFlash={null} craftLog={[]} avgCraftCost={null}
        onExecuteCraft={noop} onResetWallet={noop} refusalFor={() => null} />,
    );
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
  });
});
