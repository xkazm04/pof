import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { InventoryCatalogPanel } from '@/components/modules/core-engine/dzin-panels/InventoryCatalogPanel';
import { InventoryEquipmentPanel } from '@/components/modules/core-engine/dzin-panels/InventoryEquipmentPanel';
import { LootTablePanel } from '@/components/modules/core-engine/dzin-panels/LootTablePanel';
import { LootAffixPanel } from '@/components/modules/core-engine/dzin-panels/LootAffixPanel';
import { ItemEconomyPanel } from '@/components/modules/core-engine/dzin-panels/ItemEconomyPanel';
import { ItemDNAPanel } from '@/components/modules/core-engine/dzin-panels/ItemDNAPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];

const mockFeatureMap = new Map<string, FeatureRow>();

/* ── InventoryCatalogPanel ─────────────────────────────────────────────── */

describe('InventoryCatalogPanel at micro density', () => {
  it('renders a Package icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders completion count', () => {
    render(
      <DensityProvider density="micro">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('0/0')).toBeTruthy();
  });
});

describe('InventoryCatalogPanel at compact density', () => {
  it('renders item type names', () => {
    render(
      <DensityProvider density="compact">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Weapon')).toBeTruthy();
    expect(screen.getByText('Armor')).toBeTruthy();
    expect(screen.getByText('Consumable')).toBeTruthy();
    expect(screen.getByText('Material')).toBeTruthy();
  });
});

describe('InventoryCatalogPanel at full density', () => {
  it('renders Item Type Catalog section label', () => {
    render(
      <DensityProvider density="full">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Item Type Catalog')).toBeTruthy();
  });

  it('renders rarity tier names', () => {
    render(
      <DensityProvider density="full">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Common')).toBeTruthy();
    expect(screen.getByText('Legendary')).toBeTruthy();
  });

  it('renders Inventory Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <InventoryCatalogPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Inventory Pipeline')).toBeTruthy();
  });
});

/* ── InventoryEquipmentPanel ───────────────────────────────────────────── */

describe('InventoryEquipmentPanel at micro density', () => {
  it('renders a Shield icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders equipped count', () => {
    render(
      <DensityProvider density="micro">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5/8')).toBeTruthy();
  });
});

describe('InventoryEquipmentPanel at compact density', () => {
  it('renders slot names', () => {
    render(
      <DensityProvider density="compact">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Helmet')).toBeTruthy();
    expect(screen.getByText('Chest')).toBeTruthy();
    expect(screen.getByText('MainHand')).toBeTruthy();
  });

  it('renders total slots count', () => {
    render(
      <DensityProvider density="compact">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('8 slots total')).toBeTruthy();
  });
});

describe('InventoryEquipmentPanel at full density', () => {
  it('renders Equipment Slots section label', () => {
    render(
      <DensityProvider density="full">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Equipment Slots')).toBeTruthy();
  });

  it('renders all 8 slot names', () => {
    render(
      <DensityProvider density="full">
        <InventoryEquipmentPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Helmet')).toBeTruthy();
    expect(screen.getByText('Amulet')).toBeTruthy();
    expect(screen.getByText('Ring1')).toBeTruthy();
  });
});

/* ── LootTablePanel ────────────────────────────────────────────────────── */

describe('LootTablePanel at micro density', () => {
  it('renders a Coins icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders table count', () => {
    render(
      <DensityProvider density="micro">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4 tables')).toBeTruthy();
  });
});

describe('LootTablePanel at compact density', () => {
  it('renders loot table names', () => {
    render(
      <DensityProvider density="compact">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('LT_GoblinCommon')).toBeTruthy();
    expect(screen.getByText('LT_BossElite')).toBeTruthy();
    expect(screen.getByText('LT_WorldDrop')).toBeTruthy();
  });

  it('renders total entries count', () => {
    render(
      <DensityProvider density="compact">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('46 entries total')).toBeTruthy();
  });
});

describe('LootTablePanel at full density', () => {
  it('renders Loot Tables section label', () => {
    render(
      <DensityProvider density="full">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getAllByText('Loot Tables').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Drop Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <LootTablePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Drop Pipeline')).toBeTruthy();
  });
});

/* ── LootAffixPanel ────────────────────────────────────────────────────── */

describe('LootAffixPanel at micro density', () => {
  it('renders a Sparkles icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders total affix count', () => {
    render(
      <DensityProvider density="micro">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('26 affixes')).toBeTruthy();
  });
});

describe('LootAffixPanel at compact density', () => {
  it('renders affix category names', () => {
    render(
      <DensityProvider density="compact">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Defensive')).toBeTruthy();
    expect(screen.getByText('Utility')).toBeTruthy();
  });

  it('renders rarity tier note', () => {
    render(
      <DensityProvider density="compact">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 rarity tiers')).toBeTruthy();
  });
});

describe('LootAffixPanel at full density', () => {
  it('renders Affix Categories section label', () => {
    render(
      <DensityProvider density="full">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Affix Categories')).toBeTruthy();
  });

  it('renders Rolling Tiers section', () => {
    render(
      <DensityProvider density="full">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Rolling Tiers by Rarity')).toBeTruthy();
  });

  it('renders affix examples', () => {
    render(
      <DensityProvider density="full">
        <LootAffixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('+Damage, +CritChance, +AttackSpeed')).toBeTruthy();
  });
});

/* ── ItemEconomyPanel ──────────────────────────────────────────────────── */

describe('ItemEconomyPanel at micro density', () => {
  it('renders a TrendingUp icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders alert count', () => {
    render(
      <DensityProvider density="micro">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('1 alert')).toBeTruthy();
  });
});

describe('ItemEconomyPanel at compact density', () => {
  it('renders economy metric labels', () => {
    render(
      <DensityProvider density="compact">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Gold Influx')).toBeTruthy();
    expect(screen.getByText('Item Sink Rate')).toBeTruthy();
    expect(screen.getByText('Rarity Inflation')).toBeTruthy();
    expect(screen.getByText('Power Curve')).toBeTruthy();
  });

  it('renders metric values', () => {
    render(
      <DensityProvider density="compact">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('1,250/hr')).toBeTruthy();
    expect(screen.getByText('68%')).toBeTruthy();
  });
});

describe('ItemEconomyPanel at full density', () => {
  it('renders Economy Metrics section label', () => {
    render(
      <DensityProvider density="full">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Economy Metrics')).toBeTruthy();
  });

  it('renders Economy Alerts section', () => {
    render(
      <DensityProvider density="full">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Economy Alerts')).toBeTruthy();
  });

  it('renders radar chart SVG', () => {
    const { container } = render(
      <DensityProvider density="full">
        <ItemEconomyPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThan(0);
  });
});

/* ── ItemDNAPanel ──────────────────────────────────────────────────────── */

describe('ItemDNAPanel at micro density', () => {
  it('renders a Dna icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders trait axis count', () => {
    render(
      <DensityProvider density="micro">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 axes')).toBeTruthy();
  });
});

describe('ItemDNAPanel at compact density', () => {
  it('renders trait axis names', () => {
    render(
      <DensityProvider density="compact">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Defensive')).toBeTruthy();
    expect(screen.getByText('Arcane')).toBeTruthy();
    expect(screen.getByText('Primal')).toBeTruthy();
  });

  it('renders preset count', () => {
    render(
      <DensityProvider density="compact">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('3 presets')).toBeTruthy();
  });
});

describe('ItemDNAPanel at full density', () => {
  it('renders Trait Axes section label', () => {
    render(
      <DensityProvider density="full">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Trait Axes')).toBeTruthy();
  });

  it('renders Genome Presets section', () => {
    render(
      <DensityProvider density="full">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Genome Presets')).toBeTruthy();
    expect(screen.getByText('Warrior')).toBeTruthy();
    expect(screen.getByText('Mage')).toBeTruthy();
    expect(screen.getByText('Rogue')).toBeTruthy();
  });

  it('renders DNA Operations section', () => {
    render(
      <DensityProvider density="full">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByText('Roll Affixes')).toBeTruthy();
    expect(screen.getByText('Breed Genomes')).toBeTruthy();
  });

  it('renders radar chart SVG', () => {
    const { container } = render(
      <DensityProvider density="full">
        <ItemDNAPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThan(0);
  });
});
