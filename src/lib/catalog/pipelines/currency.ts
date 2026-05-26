import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'currencies',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a currency in PoF's grounded economy. `.repeat(6) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Economy Rules',
      view: { kind: 'table', field: 'rules', columns: [{ key: 'source' }, { key: 'sink' }, { key: 'cap' }, { key: 'conversion' }] },
      produce: () => ({ data: { rules: { source: 'quest/loot/vendor', sink: 'vendor/repair/crafting', cap: 99999, conversion: '—' } }, ueAssets: [`/Game/Economy/DT_Currencies`] }),
      accept: fieldsPopulated('rules', 'Source/sink/cap/conversion defined', ['source', 'sink', 'cap', 'conversion']),
      staticChecks: () => [cppSymbolExists('FARPGCurrencyDef', 'Currency row struct present in UE Source')],
    },
    {
      archetype: 'balance', label: 'Balance',
      view: { kind: 'table', field: 'balance', columns: [{ key: 'faucetPerHour' }, { key: 'sinkPerHour' }] },
      produce: () => ({ data: { balance: { faucetPerHour: 110, sinkPerHour: 105 }, ratio: 105 } }),
      accept: withinPercent('ratio', 'Faucet/sink balanced within ±15% (target 100)', 100, 15),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`] }),
      accept: selected('selected', 'A currency icon is selected'),
    },
    {
      archetype: 'rules', label: 'Wallet UI Integration',
      view: { kind: 'table', field: 'ui', columns: [{ key: 'widget' }, { key: 'format' }, { key: 'position' }] },
      produce: () => ({ data: { ui: { widget: 'WBP_Wallet', format: '{n} {symbol}', position: 'HUD top-right' } } }),
      accept: fieldsPopulated('ui', 'Wallet widget + format + position', ['widget', 'format', 'position']),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['earn adds to wallet', 'spend deducts', 'cap enforced'] } }),
      accept: runtimeDeferred('VSCurrencyWalletTest', 'Wallet functional test passes in UE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e) => {
        const s = slug(e.name);
        const assets = [`DT_Currencies :: ${s}`, `T_${s}_Icon`, 'WBP_Wallet'];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Economy/${a}`) };
      },
      accept: minCount('assets', 'All assets packaged', 3),
      staticChecks: () => [cppSymbolExists('FARPGCurrencyDef', 'Currency row struct present')],
    },
  ],
});
