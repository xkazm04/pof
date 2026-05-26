import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'vendors',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is an NPC merchant in PoF's grounded economy — a stationary or wandering vendor offering goods, repairs, and faction-gated deals. `.repeat(5) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Inventory Pool',
      view: { kind: 'manifest', field: 'stock' },
      produce: () => ({
        data: {
          stock: ['items::iron_sword (weapon)', 'items::health_potion (consumable)', 'items::leather_armor (armor)'],
          links: [
            { catalogId: 'items', entityId: 'iron_sword', role: 'stock' },
            { catalogId: 'items', entityId: 'health_potion', role: 'stock' },
            { catalogId: 'items', entityId: 'leather_armor', role: 'stock' },
          ],
        },
        ueAssets: ['/Game/Economy/Vendors/DT_VendorInventory'],
      }),
      accept: minCount('stock', '≥1 item linked from the items catalog', 1),
    },
    {
      archetype: 'rules', label: 'Pricing & Restock',
      view: { kind: 'table', field: 'pricing', columns: [{ key: 'markup' }, { key: 'restockHours' }, { key: 'buyback' }] },
      produce: () => ({
        data: {
          pricing: { markup: 1.25, restockHours: 24, buyback: 0.5 },
        },
      }),
      accept: fieldsPopulated('pricing', 'Markup + restockHours + buyback defined', ['markup', 'restockHours', 'buyback']),
    },
    {
      archetype: 'rules', label: 'Reputation Modifiers',
      view: { kind: 'table', field: 'repMods', columns: [{ key: 'repTier' }, { key: 'discountCurve' }] },
      produce: () => ({
        data: {
          repMods: { repTier: 'Neutral', discountCurve: 'linear_0_to_20pct' },
          links: [
            { catalogId: 'factions', entityId: 'merchants_guild', role: 'rep-source' },
          ],
        },
      }),
      accept: fieldsPopulated('repMods', 'repTier + discountCurve defined', ['repTier', 'discountCurve']),
    },
    {
      archetype: 'rules', label: 'Buy/Sell/Repair',
      view: { kind: 'table', field: 'services', columns: [{ key: 'buy' }, { key: 'sell' }, { key: 'repair' }] },
      produce: () => ({
        data: {
          services: { buy: true, sell: true, repair: true },
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'transaction-currency' },
          ],
        },
        ueAssets: ['/Game/Economy/DT_Currencies'],
      }),
      accept: fieldsPopulated('services', 'Buy + sell + repair flags set', ['buy', 'sell', 'repair']),
    },
    {
      archetype: 'balance', label: 'Economy Sim',
      view: { kind: 'table', field: 'economySim', columns: [{ key: 'marginPct' }] },
      produce: () => ({
        data: {
          economySim: { marginPct: 28 },
          marginPct: 28,
        },
      }),
      accept: withinPercent('marginPct', 'Vendor margin within ±20% of target (30)', 30, 20),
    },
    {
      archetype: 'rules', label: 'Shop UI',
      view: { kind: 'table', field: 'shopUi', columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }] },
      produce: () => ({
        data: {
          shopUi: { widget: 'WBP_VendorShop', format: 'grid_5col', anchor: 'center_screen' },
        },
      }),
      accept: fieldsPopulated('shopUi', 'Widget + format + anchor defined', ['widget', 'format', 'anchor']),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A vendor icon is selected'),
    },
    {
      archetype: 'checklist', label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({
        data: {
          keys: ['VENDOR_GREETING', 'VENDOR_BUY_PROMPT', 'VENDOR_SELL_PROMPT', 'VENDOR_REPAIR_PROMPT', 'VENDOR_FAREWELL'],
        },
      }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: ['buy deducts gold + adds item to inventory', 'sell adds gold + removes item', 'repair deducts gold + restores durability', 'restock triggers after interval', 'rep discount applied at correct tier'],
        },
      }),
      accept: runtimeDeferred('VSVendorTransactionTest', 'Buy/sell adjusts wallet + stock in PIE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`DT_VendorInventory :: ${s}`, `T_${s}_Icon`, 'WBP_VendorShop', `BP_Vendor_${s}`];
        return {
          data: { assets },
          ueAssets: assets.map((a) => `/Game/Economy/Vendors/${a}`),
        };
      },
      accept: minCount('assets', 'All assets packaged', 3),
    },
  ],
});
